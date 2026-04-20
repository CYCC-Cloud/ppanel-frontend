import type { ProtocolType } from "./form-schema";
import { getProtocolDefaultConfig } from "./form-schema";

type ListenerLike = {
  listener_key?: string;
  listener_name?: string | null;
  type?: string;
  port?: number | null;
  enable?: boolean;
};

export function appendListenerDraft(type: ProtocolType) {
  return getProtocolDefaultConfig(type);
}

export function preserveExistingListenerKeys<
  TNext extends readonly ListenerLike[],
>(existing: readonly ListenerLike[], next: TNext): TNext {
  const unmatched = new Map<number, ListenerLike>();
  existing.forEach((item, index) => {
    if (item.listener_key) {
      unmatched.set(index, item);
    }
  });

  return next.map((item) => {
    if (item.listener_key) {
      for (const [index, existingItem] of unmatched) {
        if (existingItem.listener_key === item.listener_key) {
          unmatched.delete(index);
          break;
        }
      }
      return item;
    }

    for (const [index, existingItem] of unmatched) {
      if (
        existingItem.type === item.type &&
        existingItem.port === item.port &&
        existingItem.listener_name === item.listener_name &&
        existingItem.enable === item.enable
      ) {
        unmatched.delete(index);
        return {
          ...item,
          listener_key: existingItem.listener_key,
        };
      }
    }

    return item;
  }) as unknown as TNext;
}
