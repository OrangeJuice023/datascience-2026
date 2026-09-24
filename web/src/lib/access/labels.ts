import type { FacilityType } from "@/types/access";

const FACILITY_TYPE_LABEL: Record<FacilityType, string> = {
  pharmacy: "Pharmacy",
  public_hospital: "Public hospital",
  private_hospital: "Private hospital",
  rhu: "Rural health unit",
  health_center: "Health center",
  other: "Participating facility",
};

export function facilityTypeLabel(type: FacilityType): string {
  return FACILITY_TYPE_LABEL[type];
}
