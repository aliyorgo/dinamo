// ugc_setups.ts — SETUP_IDS listesi (pipeline ugc_setups.js ile senkron)
export const SETUP_IDS = [
  'selfie_bedroom','kitchen_propped','couch_chill','bedroom_night','bathroom_mirror_getready',
  'mirror_full_body','mirror_bedroom','mirror_gym',
  'desk_review','balcony_morning',
  'walking_street','gopro_walking_wide','gopro_pov_handheld','vlog_city_explore',
  'cafe_table','car_selfie','rooftop_view',
  'chair_full_body','couch_full_body','armchair_lifestyle',
  'office_desk','office_standing','office_chair_swivel',
  'photo_studio_white','product_table_flatlay',
  'beach_seaside','nature_park','sunset_outdoor','gopro_outdoor_action',
  'gym_break',
] as const

export type SetupId = typeof SETUP_IDS[number]
