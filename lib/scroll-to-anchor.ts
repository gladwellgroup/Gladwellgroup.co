const HEADER_OFFSET_PX = 80

export function scrollToAnchor(
  selector: string,
  behavior: ScrollBehavior = "smooth",
): void {
  const el = document.querySelector(selector)
  if (!el) return

  const top =
    el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET_PX
  window.scrollTo({ top, behavior })
}
