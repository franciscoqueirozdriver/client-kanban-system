import { normalizeCNPJ, formatCNPJ } from '@/src/utils/cnpj';

type CnpjFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  value?: string;
  onValue?: (v: string) => void; // valor “cru” com 14 dígitos
  formatVisual?: boolean;        // se true, mostra 00.000.000/0000-00
};

export function CnpjField({ value, onChange, onBlur, onValue, formatVisual, ...rest }: CnpjFieldProps) {
  const raw = normalizeCNPJ(value ?? (rest.defaultValue as any));
  const display = formatVisual ? formatCNPJ(raw) : raw;

  return (
    <input
      {...rest}
      value={display}
      onChange={(e) => {
        const nextRaw = normalizeCNPJ(e.target.value);
        onValue?.(nextRaw);
        if (onChange) {
          // Create a synthetic event to pass to the original onChange handler
          const syntheticEvent = {
            ...e,
            target: {
              ...e.target,
              value: nextRaw,
            },
          };
          onChange(syntheticEvent as React.ChangeEvent<HTMLInputElement>);
        }
      }}
      onBlur={(e) => {
        const nextRaw = normalizeCNPJ(e.target.value);
        if (e.target.value !== (formatVisual ? formatCNPJ(nextRaw) : nextRaw)) {
          e.target.value = formatVisual ? formatCNPJ(nextRaw) : nextRaw;
        }
        if (onBlur) {
            onBlur(e);
        }
      }}
      inputMode="numeric"
      autoComplete="on"
    />
  );
}