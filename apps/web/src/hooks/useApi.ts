import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseQueryOptions,
  type QueryKey,
} from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api-client';

type QueryParams = Record<string, string | number | boolean | null | undefined>;
type MutationMethod = 'post' | 'patch' | 'delete';

type ApiQueryOptions<T> = Omit<UseQueryOptions<T, ApiError, T, QueryKey>, 'queryKey' | 'queryFn'>;
type ApiMutationOptions<T, TVariables> = UseMutationOptions<T, ApiError, TVariables>;

export function useApiQuery<T>(
  queryKey: QueryKey,
  url: string,
  options?: ApiQueryOptions<T> & { params?: QueryParams },
) {
  return useQuery<T, ApiError>({
    queryKey,
    queryFn: () => apiClient.get<T>(url, options?.params),
    ...options,
  });
}

export function useApiMutation<T, TVariables = unknown>(
  url: string,
  method: MutationMethod,
  options?: ApiMutationOptions<T, TVariables>,
) {
  return useMutation<T, ApiError, TVariables>({
    mutationFn: (variables) => {
      if (method === 'delete') {
        return apiClient.delete<T>(url);
      }
      if (method === 'post') {
        return apiClient.post<T>(url, variables);
      }
      return apiClient.patch<T>(url, variables);
    },
    ...options,
  });
}