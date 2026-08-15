export const SCROLL_BOTTOM_THRESHOLD_PX = 48;

export function isPinnedToBottom(element: HTMLElement): boolean {
  const { scrollTop, scrollHeight, clientHeight } = element;
  return scrollHeight - scrollTop - clientHeight <= SCROLL_BOTTOM_THRESHOLD_PX;
}

export function scrollToBottom(element: HTMLElement, behavior: ScrollBehavior = "auto"): void {
  if (typeof element.scrollTo === "function") {
    element.scrollTo({ top: element.scrollHeight, behavior });
    return;
  }

  element.scrollTop = element.scrollHeight;
}
