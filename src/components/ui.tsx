"use client";
import { ui } from "@/lib/pt-ui";
import { useEffect, useRef } from "react";
import { X, ArrowUpRight, Smile } from "lucide-react";
import { initials } from "@/lib/domain";
export function Avatar({
  name,
  small = false,
}: {
  name: string;
  small?: boolean;
}) {
  const colors = ["lilac", "peach", "mint", "blue", "rose"];
  return (
    <span
      className={`avatar ${colors[name.length % 5]} ${small ? "small" : ""}`}
    >
      {initials(name)}
    </span>
  );
}
export function Mascot({ small = false }: { small?: boolean }) {
  return (
    <div className={`mascot ${small ? "mini" : ""}`} aria-hidden="true">
      <div className="mascot-eye" />
      <div className="mascot-eye" />
      <div className="mascot-smile" />
    </div>
  );
}
export function Empty({
  title = ui.tudo_em_dia_por_aqui,
  text = ui.sua_proxima_oportunidade_comeca_com_uma_conversa,
  action,
}: {
  title?: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Smile size={32} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label={ui.fechar}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
export function CardLink({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-button" onClick={onClick}>
      {children}
      <ArrowUpRight size={16} />
    </button>
  );
}
