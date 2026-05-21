import { nanoid } from 'nanoid/non-secure'

export function uid(): string {
  return nanoid(12)
}
