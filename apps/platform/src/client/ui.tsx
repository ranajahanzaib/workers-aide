import type { Activity } from "lucide-react";
export type Perform = (
  fn: () => Promise<unknown>,
  message?: string,
) => Promise<void>;
export function date(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function Empty({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Activity;
  title: string;
  text: string;
}) {
  return (
    <div className="empty">
      <Icon size={27} strokeWidth={1.4} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function Field({
  label,
  name,
  value,
  type = "text",
  help,
}: {
  label: string;
  name: string;
  value: string | number;
  type?: string;
  help?: string;
}) {
  return (
    <label>
      {label}
      {type === "textarea" ? (
        <textarea name={name} defaultValue={value} rows={4} />
      ) : (
        <input name={name} defaultValue={value} type={type} />
      )}
      {help && <small>{help}</small>}
    </label>
  );
}
