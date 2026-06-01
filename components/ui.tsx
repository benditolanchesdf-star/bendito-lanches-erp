'use client'

import { ReactNode } from 'react'

export function Field({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputBase =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bendito-dourado focus:border-transparent transition outline-none'

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ''}`} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputBase} ${props.className ?? ''}`} />
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputBase} ${props.className ?? ''}`} />
}

export function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`bg-bendito-dourado hover:bg-bendito-dourado-escuro text-bendito-verde-escuro font-bold px-5 py-2.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed ${props.className ?? ''}`}
    >
      {children}
    </button>
  )
}

export function SecondaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-5 py-2.5 rounded-lg transition ${props.className ?? ''}`}
    >
      {children}
    </button>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-bendito-verde-escuro">{title}</h1>
          {subtitle && <p className="text-gray-600 mt-1">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  )
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-10 w-10 border-4 border-bendito-creme border-t-bendito-dourado rounded-full animate-spin" />
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-12 text-center text-gray-500">{message}</div>
  )
}

export function StatusBadge({ label, cor }: { label: string; cor: string }) {
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${cor}`}>{label}</span>
}
