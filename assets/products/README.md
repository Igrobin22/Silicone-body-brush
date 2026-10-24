# Product photo fallbacks

Updated 24 October 2026 from the owner's supplied Cloudinary galleries in
`assets/pureform-public-catalog.js` and migration `20261024000100_product_photos.sql`.
The cloud name is `dqjilscgl`; this identifies the image cloud, not its login email.

`grey-main.webp`, `black-main.webp`, and `pink-main.webp` are bounded WebP copies
of each gallery's first image, with no change to the product or colors. Use only
the matching color when a remote product image cannot load. They are not reviews.

The product galleries store the original Cloudinary URLs in owner-supplied order.
Public delivery uses format/quality optimization with a 1400px limit, without cropping.
Admin photo changes override the fallback galleries; never reset them on page load.

New admin uploads use the existing Supabase `product-photos` bucket, not Cloudinary.
Only authenticated store admins can insert; product images are public. No cloud
API secret or service-role key is included in the browser. Uploads are converted
to WebP at up to 1600px, stripping embedded metadata. Removing a photo from a
listing removes its link only; it does not delete the stored file.
