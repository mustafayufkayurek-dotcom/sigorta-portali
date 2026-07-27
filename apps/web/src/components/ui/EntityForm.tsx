'use client';

import { ReactNode } from 'react';
import { useForm, FormProvider, FieldValues, DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

interface EntityFormProps<T extends FieldValues> {
  schema: any; // Zod schema (any to avoid version conflicts)
  defaultValues?: DefaultValues<T>;
  onSubmit: (data: T) => Promise<void>;
  loading?: boolean;
  children: ReactNode;
  serverError?: string;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
}

export function EntityForm<T extends FieldValues>({
  schema,
  defaultValues,
  onSubmit,
  loading = false,
  children,
  serverError,
  submitLabel = 'Kaydet',
  cancelLabel = 'İptal',
  onCancel,
}: EntityFormProps<T>) {
  const methods = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const handleSubmit = methods.handleSubmit(async (data) => {
    try {
      await onSubmit(data);
    } catch (err: any) {
      methods.setError('root', { message: err?.message || 'Bir hata oluştu' });
    }
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {serverError && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {serverError}
          </div>
        )}
        {methods.formState.errors.root && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {methods.formState.errors.root.message}
          </div>
        )}
        {children}
        <div className="flex items-center gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Kaydediliyor...' : submitLabel}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {cancelLabel}
            </button>
          )}
        </div>
      </form>
    </FormProvider>
  );
}
