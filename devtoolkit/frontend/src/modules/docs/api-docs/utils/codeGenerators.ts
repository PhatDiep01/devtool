import { ApiEndpoint, ApiEnvironment } from '@/types';

export type CodeLanguage = 'curl' | 'javascript' | 'typescript' | 'csharp' | 'python';

export interface CodeGeneratorOptions {
  endpoint: ApiEndpoint;
  environment?: ApiEnvironment;
  activeRequestIndex?: number;
}

export function generateSnippet(
  language: CodeLanguage,
  { endpoint, environment, activeRequestIndex = 0 }: CodeGeneratorOptions
): string {
  const baseUrl = environment?.url?.replace(/\/+$/, '') || 'https://api.internal.domain';
  let pathWithParams = endpoint.path;

  // Substitute path parameters with examples or placeholders
  const pathParams = (endpoint.parameters || []).filter(p => p.in === 'path');
  for (const p of pathParams) {
    const val = p.example || p.default || `{${p.name}}`;
    pathWithParams = pathWithParams.replace(`{${p.name}}`, val).replace(`:${p.name}`, val);
  }

  // Build query string
  const queryParams = (endpoint.parameters || []).filter(p => p.in === 'query' && (p.required || p.example));
  const queryString = queryParams.length > 0 
    ? '?' + queryParams.map(p => `${encodeURIComponent(p.name)}=${encodeURIComponent(p.example || p.default || 'value')}`).join('&')
    : '';

  const fullUrl = `${baseUrl}${pathWithParams.startsWith('/') ? '' : '/'}${pathWithParams}${queryString}`;
  const method = endpoint.method.toUpperCase();

  // Selected sample request body
  const sampleRequest = endpoint.request_bodies?.[activeRequestIndex] || endpoint.request_bodies?.[0];
  const bodyText = sampleRequest?.body || '';
  const contentType = sampleRequest?.contentType || 'application/json';

  // Authorization token placeholder
  const authHeader = endpoint.auth_type === 'bearer' 
    ? 'Bearer <TOKEN>' 
    : (endpoint.auth_type === 'apikey' ? '<API_KEY>' : '');

  switch (language) {
    case 'curl':
      return generateCurlSnippet({ method, fullUrl, contentType, bodyText, authHeader, endpoint });
    case 'javascript':
      return generateJsFetchSnippet({ method, fullUrl, contentType, bodyText, authHeader, endpoint });
    case 'typescript':
      return generateAngularSnippet({ method, fullUrl, contentType, bodyText, authHeader, endpoint });
    case 'csharp':
      return generateCSharpSnippet({ method, fullUrl, contentType, bodyText, authHeader, endpoint });
    case 'python':
      return generatePythonSnippet({ method, fullUrl, contentType, bodyText, authHeader, endpoint });
    default:
      return '';
  }
}

function generateCurlSnippet({
  method,
  fullUrl,
  contentType,
  bodyText,
  authHeader,
  endpoint
}: {
  method: string;
  fullUrl: string;
  contentType: string;
  bodyText: string;
  authHeader: string;
  endpoint: ApiEndpoint;
}) {
  const parts: string[] = [`curl -X ${method} "${fullUrl}"`];

  if (['POST', 'PUT', 'PATCH'].includes(method) && bodyText) {
    parts.push(`  -H "Content-Type: ${contentType}"`);
  }

  if (authHeader) {
    parts.push(`  -H "Authorization: ${authHeader}"`);
  }

  // Header parameters
  const headerParams = (endpoint.parameters || []).filter(p => p.in === 'header' && p.required);
  for (const h of headerParams) {
    parts.push(`  -H "${h.name}: ${h.example || h.default || '<VALUE>'}"`);
  }

  if (['POST', 'PUT', 'PATCH'].includes(method) && bodyText.trim()) {
    try {
      const minified = JSON.stringify(JSON.parse(bodyText));
      parts.push(`  -d '${minified.replace(/'/g, "\\'")}'`);
    } catch {
      parts.push(`  -d '${bodyText.replace(/'/g, "\\'")}'`);
    }
  }

  return parts.join(' \\\n');
}

function generateJsFetchSnippet({
  method,
  fullUrl,
  contentType,
  bodyText,
  authHeader
}: {
  method: string;
  fullUrl: string;
  contentType: string;
  bodyText: string;
  authHeader: string;
  endpoint: ApiEndpoint;
}) {
  const headers: Record<string, string> = {};
  if (['POST', 'PUT', 'PATCH'].includes(method) && bodyText) {
    headers['Content-Type'] = contentType;
  }
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method) && bodyText.trim();
  let bodyPayload = 'undefined';
  if (hasBody) {
    try {
      bodyPayload = `JSON.stringify(${JSON.stringify(JSON.parse(bodyText), null, 2)})`;
    } catch {
      bodyPayload = JSON.stringify(bodyText);
    }
  }

  return `async function callApi() {
  const url = '${fullUrl}';
  const options = {
    method: '${method}',
    headers: ${JSON.stringify(headers, null, 4)}${hasBody ? `,\n    body: ${bodyPayload}` : ''}
  };

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    console.log('Response Status:', response.status);
    console.log('Response Data:', data);
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Call the function
callApi();`;
}

function generateAngularSnippet({
  method,
  fullUrl,
  contentType,
  bodyText,
  authHeader
}: {
  method: string;
  fullUrl: string;
  contentType: string;
  bodyText: string;
  authHeader: string;
  endpoint: ApiEndpoint;
}) {
  const methodLower = method.toLowerCase();
  const hasBody = ['post', 'put', 'patch'].includes(methodLower) && bodyText.trim();

  let bodyVar = '';
  if (hasBody) {
    try {
      bodyVar = `    const payload = ${JSON.stringify(JSON.parse(bodyText), null, 4)};\n`;
    } catch {
      bodyVar = `    const payload = ${JSON.stringify(bodyText)};\n`;
    }
  }

  return `import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly baseUrl = '${fullUrl}';

  constructor(private http: HttpClient) {}

  executeRequest(): Observable<any> {
    const headers = new HttpHeaders({
      ${authHeader ? `'Authorization': '${authHeader}',` : ''}
      'Content-Type': '${contentType}'
    });

${bodyVar}    return this.http.${methodLower}<any>(
      this.baseUrl,
      ${hasBody ? 'payload, ' : ''}{ headers }
    );
  }
}`;
}

function generateCSharpSnippet({
  method,
  fullUrl,
  contentType,
  bodyText,
  authHeader
}: {
  method: string;
  fullUrl: string;
  contentType: string;
  bodyText: string;
  authHeader: string;
  endpoint: ApiEndpoint;
}) {
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method) && bodyText.trim();
  let jsonString = '';
  if (hasBody) {
    try {
      jsonString = JSON.stringify(JSON.parse(bodyText), null, 2);
    } catch {
      jsonString = bodyText;
    }
  }

  return `using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

namespace DevToolkit.ApiClient
{
    public class Program
    {
        private static readonly HttpClient client = new HttpClient();

        public static async Task Main(string[] args)
        {
            var request = new HttpRequestMessage(HttpMethod.${capitalizeFirst(method.toLowerCase())}, "${fullUrl}");
            
            ${authHeader ? `request.Headers.Add("Authorization", "${authHeader}");` : '// No auth required'}

            ${hasBody ? `var jsonContent = @"${jsonString.replace(/"/g, '""')}";
            request.Content = new StringContent(jsonContent, Encoding.UTF8, "${contentType}");` : ''}

            try
            {
                var response = await client.SendAsync(request);
                response.EnsureSuccessStatusCode();
                string responseBody = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"Status: {response.StatusCode}");
                Console.WriteLine(responseBody);
            }
            catch (HttpRequestException ex)
            {
                Console.WriteLine($"Error: {ex.Message}");
            }
        }
    }
}`;
}

function generatePythonSnippet({
  method,
  fullUrl,
  contentType,
  bodyText,
  authHeader
}: {
  method: string;
  fullUrl: string;
  contentType: string;
  bodyText: string;
  authHeader: string;
  endpoint: ApiEndpoint;
}) {
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method) && bodyText.trim();
  let pythonData = 'None';
  if (hasBody) {
    try {
      pythonData = JSON.stringify(JSON.parse(bodyText), null, 4);
    } catch {
      pythonData = `"${bodyText}"`;
    }
  }

  return `import requests

url = "${fullUrl}"
headers = {
    ${authHeader ? `"Authorization": "${authHeader}",` : ''}
    "Content-Type": "${contentType}"
}
${hasBody ? `payload = ${pythonData}\n` : ''}
try:
    response = requests.${method.toLowerCase()}(
        url,
        headers=headers${hasBody ? ',\n        json=payload' : ''}
    )
    print("Status Code:", response.status_code)
    print("Response JSON:", response.json())
except requests.exceptions.RequestException as e:
    print("API Error:", e)`;
}

function capitalizeFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
