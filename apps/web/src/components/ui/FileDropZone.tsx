'use client';

import { useRef, useState, type LegacyRef, type ReactNode, type RefObject } from 'react';

type FileDropZoneProps = {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  activeClassName?: string;
  children: ReactNode;
  inputId?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  resetAfterSelect?: boolean;
  clickToOpen?: boolean;
  capture?: boolean | 'user' | 'environment';
};

function joinClasses(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function FileDropZone({
  onFiles,
  accept,
  multiple,
  disabled = false,
  className = '',
  activeClassName = 'border-blue-400 bg-blue-50',
  children,
  inputId,
  inputRef: externalInputRef,
  resetAfterSelect = true,
  clickToOpen = true,
  capture,
}: FileDropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef ?? internalInputRef;

  const processFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || disabled) return;
    onFiles(Array.from(fileList));
  };

  const openPicker = () => {
    if (!disabled && clickToOpen) inputRef.current?.click();
  };

  return (
    <>
      <div
        role={clickToOpen ? 'button' : undefined}
        tabIndex={clickToOpen && !disabled ? 0 : undefined}
        aria-disabled={disabled || undefined}
        className={joinClasses(className, dragging && activeClassName)}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (!clickToOpen || disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (disabled) return;
          processFiles(e.dataTransfer.files);
        }}
      >
        {children}
      </div>
      <input
        id={inputId}
        ref={inputRef as LegacyRef<HTMLInputElement>}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="hidden"
        {...(capture ? { capture } : {})}
        onChange={(e) => {
          processFiles(e.target.files);
          if (resetAfterSelect) e.target.value = '';
        }}
      />
    </>
  );
}
