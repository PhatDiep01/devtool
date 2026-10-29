/**
 * JWT Decoder Engine: 100% Client-Side Parsing, Claims Inspection & Cryptographic Signature Verification
 * Reads standard & custom claims, evaluates expiration, and verifies HS256/HS384/HS512 and RS256.
 */

import { ParsedJwt, JwtClaimInfo, JwtHeader, JwtPayload, JwtValidityStatus } from '../types';
import { formatDistanceToNow, format } from 'date-fns';
import { vi } from 'date-fns/locale';

// Common standard claims dictionary with Vietnamese explanations
const STANDARD_CLAIMS_MAP: Record<string, { label: string; description: string }> = {
  iss: { label: 'Issuer (Nhà phát hành)', description: 'Bên khởi tạo và phát hành token xác thực' },
  sub: { label: 'Subject (Chủ thể)', description: 'Định danh đối tượng sở hữu token (thường là User ID hoặc Username)' },
  aud: { label: 'Audience (Đối tượng nhận)', description: 'Hệ thống, ứng dụng hoặc dịch vụ được phép tiêu thụ token này' },
  exp: { label: 'Expiration Time (Hết hạn)', description: 'Thời điểm token hết hiệu lực (Unix timestamp giây)' },
  nbf: { label: 'Not Before (Không dùng trước)', description: 'Thời điểm sớm nhất token bắt đầu có hiệu lực' },
  iat: { label: 'Issued At (Khởi tạo)', description: 'Thời điểm token được sinh ra' },
  jti: { label: 'JWT ID (Mã định danh)', description: 'Định danh duy nhất toàn cầu cho token (chống replay attack)' },
  typ: { label: 'Type (Loại token)', description: 'Thường là JWT' },
  alg: { label: 'Algorithm (Thuật toán ký)', description: 'Thuật toán dùng để tạo chữ ký (HS256, RS256...)' },
  kid: { label: 'Key ID (Mã khóa)', description: 'Mã định danh của public/private key dùng để ký' },
  name: { label: 'Full Name (Tên đầy đủ)', description: 'Tên hiển thị của người dùng' },
  email: { label: 'Email', description: 'Địa chỉ thư điện tử người dùng' },
  roles: { label: 'Roles (Phân quyền)', description: 'Danh sách các vai trò được phân quyền của tài khoản' },
  role: { label: 'Role (Vai trò)', description: 'Vai trò người dùng trong hệ thống' },
  scope: { label: 'Scope (Phạm vi)', description: 'Phạm vi quyền hạn được cấp phép (OAuth 2.0)' }
};

/**
 * Base64URL decode helper for UTF-8 JSON payloads
 */
function decodeBase64Url(str: string): string {
  let output = str.replace(/-/g, '+').replace(/_/g, '/');
  switch (output.length % 4) {
    case 0:
      break;
    case 2:
      output += '==';
      break;
    case 3:
      output += '=';
      break;
    default:
      throw new Error('Độ dài Base64URL không hợp lệ');
  }

  const binary = atob(output);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * Convert base64url string to Uint8Array bytes
 */
function base64UrlToBytes(str: string): Uint8Array {
  let output = str.replace(/-/g, '+').replace(/_/g, '/');
  while (output.length % 4 !== 0) {
    output += '=';
  }
  const binary = atob(output);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Parses timestamp value (seconds or milliseconds) and formats date info
 */
function parseTimeClaim(val: any): { date: Date; formatted: string; relative: string } | null {
  if (typeof val !== 'number') return null;
  // If > 1e11 it's in milliseconds, otherwise seconds
  const ms = val > 1e11 ? val : val * 1000;
  const date = new Date(ms);
  if (isNaN(date.getTime())) return null;

  try {
    const formatted = format(date, 'dd/MM/yyyy HH:mm:ss');
    const relative = formatDistanceToNow(date, { addSuffix: true, locale: vi });
    return { date, formatted, relative };
  } catch {
    return null;
  }
}

/**
 * Parses full JWT string into structured inspection data
 */
export function parseJwt(jwtToken: string): ParsedJwt {
  const clean = jwtToken.trim();

  const emptyResult: ParsedJwt = {
    isValid: false,
    rawHeader: '',
    rawPayload: '',
    rawSignature: '',
    headerObj: null,
    payloadObj: null,
    formattedHeaderJson: '',
    formattedPayloadJson: '',
    status: 'malformed',
    statusMessage: 'Vui lòng dán chuỗi JWT để bắt đầu giải mã',
    algorithm: '',
    tokenType: '',
    isAlgNone: false,
    claims: [],
    errors: {}
  };

  if (!clean) return emptyResult;

  const parts = clean.split('.');
  if (parts.length !== 3) {
    return {
      ...emptyResult,
      errors: {
        structure: `JWT không hợp lệ: cấu trúc chuẩn phải có đúng 3 phần phân cách bởi 2 dấu chấm '.', hiện có ${parts.length} phần.`
      },
      statusMessage: 'Cấu trúc token không đúng định dạng JWT (Header.Payload.Signature)'
    };
  }

  const [rawHeader, rawPayload, rawSignature] = parts;
  let headerObj: JwtHeader | null = null;
  let payloadObj: JwtPayload | null = null;
  let formattedHeaderJson = '';
  let formattedPayloadJson = '';
  const errors: { header?: string; payload?: string } = {};

  // 1. Decode Header
  try {
    const headerStr = decodeBase64Url(rawHeader);
    try {
      headerObj = JSON.parse(headerStr);
      formattedHeaderJson = JSON.stringify(headerObj, null, 2);
    } catch {
      errors.header = 'Header được Base64 hợp lệ nhưng không phải định dạng JSON hợp chuẩn';
    }
  } catch (err: any) {
    errors.header = `Không thể giải mã Base64URL phần Header: ${err?.message || 'Ký tự không hợp lệ'}`;
  }

  // 2. Decode Payload
  try {
    const payloadStr = decodeBase64Url(rawPayload);
    try {
      payloadObj = JSON.parse(payloadStr);
      formattedPayloadJson = JSON.stringify(payloadObj, null, 2);
    } catch {
      errors.payload = 'Payload được Base64 hợp lệ nhưng không phải định dạng JSON hợp chuẩn';
    }
  } catch (err: any) {
    errors.payload = `Không thể giải mã Base64URL phần Payload: ${err?.message || 'Ký tự không hợp lệ'}`;
  }

  const algorithm = headerObj?.alg || 'unknown';
  const tokenType = headerObj?.typ || 'JWT';
  const isAlgNone = algorithm.toLowerCase() === 'none';

  // 3. Claims Analysis
  const claims: JwtClaimInfo[] = [];
  let status: JwtValidityStatus = 'no_exp';
  let statusMessage = 'Token không chứa thời gian hết hạn (exp)';

  if (payloadObj && typeof payloadObj === 'object') {
    const now = Math.floor(Date.now() / 1000);

    // Evaluate Exp / Nbf status
    const exp = payloadObj.exp;
    const nbf = payloadObj.nbf;

    if (typeof exp === 'number') {
      const expSec = exp > 1e11 ? Math.floor(exp / 1000) : exp;
      if (now > expSec) {
        status = 'expired';
        const parsed = parseTimeClaim(exp);
        statusMessage = `Đã hết hạn (${parsed?.relative || 'quá khứ'})`;
      } else if (typeof nbf === 'number') {
        const nbfSec = nbf > 1e11 ? Math.floor(nbf / 1000) : nbf;
        if (now < nbfSec) {
          status = 'not_yet_valid';
          const parsed = parseTimeClaim(nbf);
          statusMessage = `Chưa có hiệu lực (bắt đầu có hiệu lực ${parsed?.relative || 'trong tương lai'})`;
        } else {
          status = 'valid';
          const parsed = parseTimeClaim(exp);
          statusMessage = `Còn hiệu lực (hết hạn ${parsed?.relative || 'sắp tới'})`;
        }
      } else {
        status = 'valid';
        const parsed = parseTimeClaim(exp);
        statusMessage = `Còn hiệu lực (hết hạn ${parsed?.relative || 'sắp tới'})`;
      }
    } else if (typeof nbf === 'number') {
      const nbfSec = nbf > 1e11 ? Math.floor(nbf / 1000) : nbf;
      if (now < nbfSec) {
        status = 'not_yet_valid';
        const parsed = parseTimeClaim(nbf);
        statusMessage = `Chưa có hiệu lực (bắt đầu ${parsed?.relative || 'tương lai'})`;
      } else {
        status = 'no_exp';
        statusMessage = 'Đã có hiệu lực, không có thông tin hạn hết';
      }
    }

    // Process every claim key
    Object.keys(payloadObj).forEach((key) => {
      const val = payloadObj![key];
      const standard = STANDARD_CLAIMS_MAP[key];
      const isTimeClaim = key === 'exp' || key === 'iat' || key === 'nbf';
      const timeInfo = isTimeClaim ? parseTimeClaim(val) : null;

      claims.push({
        key,
        value: val,
        label: standard ? standard.label : key,
        description: standard ? standard.description : 'Custom Claim của ứng dụng',
        isStandard: !!standard,
        formattedTime: timeInfo ? timeInfo.formatted : undefined,
        relativeTime: timeInfo ? timeInfo.relative : undefined
      });
    });
  }

  const isValid = !errors.header && !errors.payload && !!headerObj && !!payloadObj;

  return {
    isValid,
    rawHeader,
    rawPayload,
    rawSignature,
    headerObj,
    payloadObj,
    formattedHeaderJson,
    formattedPayloadJson,
    status: isValid ? status : 'malformed',
    statusMessage: isValid ? statusMessage : 'Dữ liệu Header hoặc Payload bị lỗi',
    algorithm,
    tokenType,
    isAlgNone,
    claims,
    errors
  };
}

/**
 * Verifies JWT signature using Web Crypto API.
 * Supports:
 * - HS256, HS384, HS512 (with HMAC secret key)
 * - RS256 (with RSA Public Key in PEM format)
 */
export async function verifyJwtSignature(
  rawHeader: string,
  rawPayload: string,
  rawSignature: string,
  alg: string,
  secretOrPublicKey: string
): Promise<{ valid: boolean; message: string }> {
  if (!secretOrPublicKey || !secretOrPublicKey.trim()) {
    return { valid: false, message: 'Vui lòng nhập khóa bí mật (Secret Key) hoặc Public Key để xác minh.' };
  }

  if (!rawSignature) {
    return { valid: false, message: 'Token không chứa chữ ký (Signature rỗng).' };
  }

  const upperAlg = (alg || '').toUpperCase();
  const signingInput = `${rawHeader}.${rawPayload}`;
  const signingBytes = new TextEncoder().encode(signingInput);

  // 1. HMAC algorithms (HS256, HS384, HS512)
  if (upperAlg === 'HS256' || upperAlg === 'HS384' || upperAlg === 'HS512') {
    let hashName = 'SHA-256';
    if (upperAlg === 'HS384') hashName = 'SHA-384';
    if (upperAlg === 'HS512') hashName = 'SHA-512';

    try {
      const keyBytes = new TextEncoder().encode(secretOrPublicKey);
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes as any,
        { name: 'HMAC', hash: { name: hashName } },
        false,
        ['verify', 'sign']
      );

      const signatureBytes = base64UrlToBytes(rawSignature);
      const isValid = await crypto.subtle.verify('HMAC', cryptoKey, signatureBytes as any, signingBytes as any);

      return {
        valid: isValid,
        message: isValid
          ? `Chữ ký HỢP LỆ! Token đã được ký chuẩn xác bằng thuật toán ${upperAlg} với khóa được cung cấp.`
          : `Chữ ký KHÔNG HỢP LỆ! Khóa bí mật không khớp hoặc nội dung token đã bị thay đổi.`
      };
    } catch (err: any) {
      return {
        valid: false,
        message: `Lỗi trong quá trình tính toán chữ ký HMAC: ${err?.message || 'Không thể xác minh'}`
      };
    }
  }

  // 2. RSA algorithms (RS256)
  if (upperAlg === 'RS256') {
    try {
      // Clean PEM public key
      let pem = secretOrPublicKey.trim();
      pem = pem.replace(/-----BEGIN (?:RSA )?PUBLIC KEY-----/g, '');
      pem = pem.replace(/-----END (?:RSA )?PUBLIC KEY-----/g, '');
      pem = pem.replace(/[\r\n\s]/g, '');

      const binaryDer = atob(pem);
      const spkiBytes = new Uint8Array(binaryDer.length);
      for (let i = 0; i < binaryDer.length; i++) {
        spkiBytes[i] = binaryDer.charCodeAt(i);
      }

      const cryptoKey = await crypto.subtle.importKey(
        'spki',
        spkiBytes as any,
        { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
        false,
        ['verify']
      );

      const signatureBytes = base64UrlToBytes(rawSignature);
      const isValid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signatureBytes as any, signingBytes as any);

      return {
        valid: isValid,
        message: isValid
          ? 'Chữ ký HỢP LỆ! Token được xác minh thành công bằng RSA Public Key.'
          : 'Chữ ký KHÔNG HỢP LỆ! Public Key không khớp hoặc nội dung token đã bị thay đổi.'
      };
    } catch (err: any) {
      return {
        valid: false,
        message: `Public Key không hợp lệ hoặc sai định dạng PEM SPKI (cần định dạng -----BEGIN PUBLIC KEY-----): ${err?.message || ''}`
      };
    }
  }

  return {
    valid: false,
    message: `Thuật toán "${alg}" hiện không được hỗ trợ xác thực trực tiếp trên trình duyệt (chỉ hỗ trợ HS256, HS384, HS512, RS256).`
  };
}
