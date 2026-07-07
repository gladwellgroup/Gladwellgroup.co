"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  AMERICAS_PHONE_CODES,
  DEFAULT_PHONE_COUNTRY,
  getPhoneCodeByIso,
} from "@/lib/data/americas-phone-codes"
import { isoToFlagEmoji } from "@/lib/phone"
import { cn } from "@/lib/utils"

interface CountryPhoneSelectProps {
  value: string
  onChange: (iso: string) => void
  id?: string
  disabled?: boolean
}

export function CountryPhoneSelect({
  value,
  onChange,
  id,
  disabled = false,
}: CountryPhoneSelectProps) {
  const [open, setOpen] = useState(false)
  const selected =
    getPhoneCodeByIso(value) ?? getPhoneCodeByIso(DEFAULT_PHONE_COUNTRY)!

  const handleSelect = (iso: string) => {
    onChange(iso)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-label="Indicativo de país"
          aria-expanded={open}
          className="modal-field country-phone-trigger flex w-[8rem] shrink-0 items-center justify-between gap-1 px-2.5 py-2.5 text-left"
        >
          <span className="flex min-w-0 items-center gap-1">
            <span className="shrink-0 text-base leading-none" aria-hidden="true">
              {isoToFlagEmoji(selected.iso)}
            </span>
            <span className="truncate text-sm font-semibold">{selected.iso}</span>
            <span className="truncate text-xs text-muted-foreground">{selected.dialCode}</span>
          </span>
          <ChevronDown
            className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        collisionPadding={12}
        className="z-[60] w-64 p-1"
        onWheel={(e) => e.stopPropagation()}
      >
        <ul
          role="listbox"
          aria-label="Países de América"
          className="max-h-60 overflow-y-auto overscroll-contain"
          onWheel={(e) => e.stopPropagation()}
        >
          {AMERICAS_PHONE_CODES.map(({ iso, name, dialCode }) => {
            const isSelected = iso === selected.iso
            return (
              <li key={iso} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(iso)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted",
                    isSelected && "bg-muted"
                  )}
                >
                  <span className="shrink-0 text-base leading-none" aria-hidden="true">
                    {isoToFlagEmoji(iso)}
                  </span>
                  <span className="w-7 shrink-0 font-semibold">{iso}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{dialCode}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
