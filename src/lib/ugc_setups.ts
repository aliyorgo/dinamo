// ugc_setups.ts — SETUP_IDS listesi (pipeline ugc_setups.js ile senkron)
// Selfie/mirror setup'lar kaldirildi — tum setup'lar third-person
export const SETUP_IDS = [
  'kitchen_propped','couch_chill','bedroom_night',
  'desk_review','balcony_morning',
  'walking_street','gopro_walking_wide','vlog_city_explore',
  'cafe_table','rooftop_view',
  'chair_full_body','couch_full_body','armchair_lifestyle',
  'office_desk','office_standing',
  'photo_studio_white',
  'beach_seaside','nature_park','sunset_outdoor','gopro_outdoor_action',
  'gym_break',
] as const

export type SetupId = typeof SETUP_IDS[number]
