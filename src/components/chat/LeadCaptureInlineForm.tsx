import React, { useEffect, useState } from "react";

type LeadCaptureInlineFormProps = {
  pendingField: "name" | "phone" | "email" | null;
  disabled?: boolean;
  onSubmit: (value: string) => Promise<void>;
};

const labels: Record<string, string> = {
  name: "Share your name",
  phone: "Share your mobile with country code",
  email: "Share your business email",
};

const placeholders: Record<string, string> = {
  name: "John Smith",
  phone: "+91 98765 43210",
  email: "john@company.com",
};

export const LeadCaptureInlineForm: React.FC<LeadCaptureInlineFormProps> = ({
  pendingField,
  disabled,
  onSubmit,
}) => {
  const [value, setValue] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setValue("");
    setValidationError(null);
  }, [pendingField]);

  if (!pendingField) {
    return null;
  }

  const validate = (nextValue: string): string | null => {
    const trimmed = nextValue.trim();
    if (!trimmed) {
      return null;
    }

    if (pendingField === "phone") {
      const digits = trimmed.replace(/\D/g, "");
      if (digits.length < 10) {
        return "Please enter at least 10 digits, with country code if available.";
      }
    }

    return null;
  };

  const commitValue = async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    const nextError = validate(trimmed);
    setValidationError(nextError);
    if (nextError) {
      return;
    }

    await onSubmit(trimmed);
    setValue("");
    setValidationError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await commitValue();
  };

  return (
    <form className="chat-inline-form" onSubmit={submit}>
      <label htmlFor="chat-inline-capture" className="chat-inline-form-label">
        {labels[pendingField]}
      </label>
      <div className="chat-inline-form-row">
        <input
          id="chat-inline-capture"
          type={pendingField === "email" ? "email" : "text"}
          value={value}
          disabled={disabled}
          inputMode={pendingField === "phone" ? "tel" : pendingField === "email" ? "email" : "text"}
          onChange={(event) => {
            const nextValue = event.target.value;
            setValue(nextValue);
            setValidationError(validate(nextValue));
          }}
          onBlur={() => {
            if (!disabled) {
              void commitValue();
            }
          }}
          placeholder={placeholders[pendingField]}
          className="chat-inline-form-input"
        />
      </div>
      <p className="text-xs text-slate-500">We will capture this automatically once it is complete.</p>
      {validationError && <p className="text-xs text-red-600">{validationError}</p>}
    </form>
  );
};
