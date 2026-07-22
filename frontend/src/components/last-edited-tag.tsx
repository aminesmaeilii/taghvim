import { MARKETING_ROLE_LABELS } from "@shared/constants/defaults";
import type { MarketingRole } from "@shared/types/domain";
import { formatJalaliDate } from "@shared/utils/jalali";

export function LastEditedTag({ updatedByName, updatedByRole, updatedAt }: { updatedByName?: string | null; updatedByRole?: string | null; updatedAt?: string | null }) {
  if (!updatedByName || !updatedAt) return null;
  const role = updatedByRole ? MARKETING_ROLE_LABELS[updatedByRole as MarketingRole] : null;
  return <small className="last-edited-tag">آخرین ویرایش توسط {updatedByName}{role ? ` - ${role}` : ""} در {formatJalaliDate(updatedAt)}</small>;
}
