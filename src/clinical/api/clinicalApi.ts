import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type { ClinicalSession } from '../types';

export class ClinicalApi {
  private readonly http: AxiosInstance;

  constructor(
    private readonly getSession: () => ClinicalSession,
    baseURL = String(import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8888'),
  ) {
    this.http = axios.create({
      baseURL: baseURL.replace(/\/$/, ''),
      timeout: Number(import.meta.env.VITE_CLINICAL_API_TIMEOUT_MS || 15000),
    });

    this.http.interceptors.request.use((config) => {
      const session = this.getSession();
      config.headers = config.headers || {};
      if (session.accessToken) config.headers.Authorization = `Bearer ${session.accessToken}`;
      config.headers['x-request-id'] = crypto.randomUUID();
      config.headers['x-purpose-of-use'] = session.purposeOfUse || 'TREATMENT';
      return config;
    });
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return (await this.http.get<T>(url, config)).data;
  }

  async post<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return (await this.http.post<T>(url, body, config)).data;
  }

  async put<T>(url: string, body?: unknown): Promise<T> {
    return (await this.http.put<T>(url, body)).data;
  }

  async delete<T>(url: string): Promise<T> {
    return (await this.http.delete<T>(url)).data;
  }
}
