"use client";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Modal } from "./Modal.js";
import { Button } from "./Button.js";
import { Input } from "./Input.js";
import { FormField } from "./FormField.js";

export interface PromptOptions {
  title: string;
  label?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  inputType?: "text" | "url" | "email";
}

type PromptFn = (opts: PromptOptions) => Promise<string | null>;

const PromptContext = createContext<PromptFn | null>(null);

// Promise-based text-input dialog to replace window.prompt. Wrap the app in
// <PromptProvider> and call const value = await usePrompt()({ ... }); resolves
// to the trimmed string, or null if the user cancels.
export function PromptProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<PromptOptions | null>(null);
  const [value, setValue] = useState("");
  const resolverRef = useRef<((v: string | null) => void) | null>(null);

  const prompt = useCallback<PromptFn>((o) => {
    setOpts(o);
    setValue(o.defaultValue ?? "");
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((v: string | null) => {
    resolverRef.current?.(v);
    resolverRef.current = null;
    setOpts(null);
    setValue("");
  }, []);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    settle(trimmed ? trimmed : null);
  }, [value, settle]);

  return (
    <PromptContext.Provider value={prompt}>
      {children}
      <Modal
        open={!!opts}
        onClose={() => settle(null)}
        size="sm"
        title={opts?.title ?? ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => settle(null)}>
              {opts?.cancelLabel ?? "Cancel"}
            </Button>
            <Button variant="primary" onClick={submit}>
              {opts?.confirmLabel ?? "OK"}
            </Button>
          </>
        }
      >
        <FormField label={opts?.label} hint={opts?.description}>
          <Input
            autoFocus
            type={opts?.inputType ?? "text"}
            placeholder={opts?.placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
        </FormField>
      </Modal>
    </PromptContext.Provider>
  );
}

export function usePrompt(): PromptFn {
  const ctx = useContext(PromptContext);
  if (!ctx) throw new Error("usePrompt must be used within PromptProvider");
  return ctx;
}
