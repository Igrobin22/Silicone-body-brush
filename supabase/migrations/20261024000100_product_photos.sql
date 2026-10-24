-- Owner-supplied Cloudinary galleries, 24 October 2026. First photo is the main image.
-- Apply once. Later admin photo edits remain authoritative; do not reapply to reset them.
begin;
update public.site_listings set photo_urls = array[
  'https://res.cloudinary.com/dqjilscgl/image/upload/v1779553521/Main_with_background_anlah0.png',
  'https://res.cloudinary.com/dqjilscgl/image/upload/v1792822128/grey_body_acy8rv.jpg',
  'https://res.cloudinary.com/dqjilscgl/image/upload/v1779553535/grey_Head_h1duwj.png',
  'https://res.cloudinary.com/dqjilscgl/image/upload/v1779553529/grey_face_qpwaey.png',
  'https://res.cloudinary.com/dqjilscgl/image/upload/v1779553512/grey_Handle_zkieiu.png'
] where slug = 'pureform-4pc-set-grey';

update public.site_listings set photo_urls = array[
  'https://res.cloudinary.com/dqjilscgl/image/upload/v1792821805/main_rjtosu.png',
  'https://res.cloudinary.com/dqjilscgl/image/upload/v1792821849/b_handle_2_tphvrt.png',
  'https://res.cloudinary.com/dqjilscgl/image/upload/v1792821853/b_head_2_o21dux.jpg',
  'https://res.cloudinary.com/dqjilscgl/image/upload/v1792821851/b_head_1_jz208y.jpg',
  'https://res.cloudinary.com/dqjilscgl/image/upload/v1792821846/b_handle_1_wo3prl.jpg',
  'https://res.cloudinary.com/dqjilscgl/image/upload/v1792821842/b_body_l5gx9z.jpg',
  'https://res.cloudinary.com/dqjilscgl/image/upload/v1792821844/b_face_1_xnh9qv.jpg'
] where slug = 'pureform-4pc-set-black';

update public.site_listings set photo_urls = array[
  'https://res.cloudinary.com/dqjilscgl/image/upload/v1780227617/main_img_voei63.png',
  'https://res.cloudinary.com/dqjilscgl/image/upload/v1780227619/p_handle_1_crtic9.png',
  'https://res.cloudinary.com/dqjilscgl/image/upload/v1780227619/p_handle_2_komo0m.png',
  'https://res.cloudinary.com/dqjilscgl/image/upload/v1780227617/p_face_1_f4vdyz.png',
  'https://res.cloudinary.com/dqjilscgl/image/upload/v1780227619/p_face_2_yoirlr.png',
  'https://res.cloudinary.com/dqjilscgl/image/upload/v1780227616/p_body_1_kgg059.png',
  'https://res.cloudinary.com/dqjilscgl/image/upload/v1780227617/p_body_2_lv1x37.png',
  'https://res.cloudinary.com/dqjilscgl/image/upload/v1780227620/p_head_2_vtl4pl.png',
  'https://res.cloudinary.com/dqjilscgl/image/upload/v1780227619/p_head_1_yquyts.png'
] where slug = 'pureform-4pc-set-pink';
commit;
