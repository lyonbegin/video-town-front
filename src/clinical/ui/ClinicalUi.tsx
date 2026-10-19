import React from 'react';

export function ClinicalCard({
  title, children, className = '',
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`cf-card ${className}`}>{title && <h3>{title}</h3>}{children}</section>;
}

export function ClinicalNotice({
  children, tone = 'info',
}: {
  children: React.ReactNode;
  tone?: 'info'|'success'|'warning'|'danger';
}) {
  return <div className={`cf-notice cf-notice--${tone}`}>{children}</div>;
}

export function ClinicalBadge({
  children, tone = 'info',
}: {
  children: React.ReactNode;
  tone?: 'info'|'success'|'warning'|'danger'|'neutral';
}) {
  return <span className={`cf-badge cf-badge--${tone}`}>{children}</span>;
}

export function ClinicalButton({
  children, variant = 'primary', onClick, disabled, type='button',
}: {
  children: React.ReactNode;
  variant?: 'primary'|'secondary'|'danger';
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button'|'submit';
}) {
  return <button type={type} className={`cf-button cf-button--${variant}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

export function ClinicalField({
  label, value, onChange, placeholder = '입력 또는 선택', type='text',
}: {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="cf-field">
      <span>{label}</span>
      <input
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </label>
  );
}

export function ClinicalEmpty({ message }: { message: string }) {
  return <div className="cf-empty">{message}</div>;
}

export function JsonDebug({ value }: { value: unknown }) {
  if (!import.meta.env.DEV) return null;
  return <details className="cf-debug"><summary>개발 데이터</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>;
}
