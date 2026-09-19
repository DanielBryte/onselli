export type ApiResult<T> = { data: T; error?: never } | { data?: never; error: string };
