"use client";

type CloseWindowButtonProps = {
  className?: string;
  label?: string;
};

export default function CloseWindowButton({
  className,
  label = "Close",
}: CloseWindowButtonProps) {
  return (
    <button
      type="button"
      onClick={() => window.close()}
      className={className}
    >
      {label}
    </button>
  );
}
