export class ApiResponse<T> {
  /**
   * HTTP status code (200, 400, 404, etc.)
   */
  status: number;

  /**
   * Message describing the result of the API call.
   */
  message: string;

  /**
   * The actual response data (generic type).
   */
  data?: T | null;

  constructor(status: number, message: string, data?: T | null) {
    this.status = status;
    this.message = message;
    this.data = data ?? null;
  }
}
