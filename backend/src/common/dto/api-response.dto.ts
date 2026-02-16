export class ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  total?: number;
  page?: number;
  pageSize?: number;

  static ok<T>(data: T, message = 'success'): ApiResponse<T> {
    const res = new ApiResponse<T>();
    res.success = true;
    res.data = data;
    res.message = message;
    return res;
  }

  static paginated<T>(
    data: T[],
    total: number,
    page: number,
    pageSize: number,
  ): ApiResponse<T[]> {
    const res = new ApiResponse<T[]>();
    res.success = true;
    res.data = data;
    res.total = total;
    res.page = page;
    res.pageSize = pageSize;
    return res;
  }

  static fail(message: string): ApiResponse {
    const res = new ApiResponse();
    res.success = false;
    res.message = message;
    return res;
  }
}
