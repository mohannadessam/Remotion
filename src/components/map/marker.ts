// Shared look for truck markers and the "you are here" dot (MapLibre map and static fallback).
export const MARKER_CLASS =
  "group grid size-11 cursor-pointer place-items-center rounded-full border-[3px] border-white bg-[var(--marker-color)] shadow-md transition-transform data-[selected=true]:scale-125 data-[selected=true]:z-10";

export const MARKER_INNER_HTML =
  '<span data-emoji class="text-lg leading-none"></span><span aria-hidden="true" class="absolute -bottom-1 size-2 rotate-45 bg-[var(--marker-color)]"></span>';

export const USER_DOT_CLASS =
  "size-4 rounded-full border-[3px] border-white bg-navy shadow-[0_0_0_6px_rgb(4_44_83/0.2)]";
