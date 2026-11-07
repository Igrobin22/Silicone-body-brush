# Opening Scene

The current opening shows all three store colors, in Grey / Black / Pink order:

- Grey: `grey-set-600.webp`, resized from `../products/grey-main.webp`.
- Black: `black-set-600.webp`, resized from `../products/black-main.webp`.
- Pink: `pink-set-600.webp`, resized from `../products/pink-main.webp`.

These are the owner's matching full-set catalog photos supplied on 24 October
2026, not AI-styled lifestyle scenes or customer-review photos. The legacy
`black-listing-600.webp` is no longer used: it depicted a grey-looking back brush
under the Black caption. Original sources, in the same order:

- https://res.cloudinary.com/dqjilscgl/image/upload/v1779553521/Main_with_background_anlah0.png
- https://res.cloudinary.com/dqjilscgl/image/upload/v1792821805/main_rjtosu.png
- https://res.cloudinary.com/dqjilscgl/image/upload/v1780227617/main_img_voei63.png

Each image is contained and uncropped at 600 x 600 pixels, encoded as WebP at
quality 82. No colors or product content were changed. Together they total
69,646 bytes. No new photography, video player or animation dependency is needed.

The Grey set starts large, recedes left as Black and Pink enter, then all slide down
to reveal PureForm before the layer lifts into the original hero. This adapts
the supplied HeroLaunch sequence in the site's existing CSS/vanilla JavaScript.
Portrait phones show Grey and Black above Pink so every color fits with a
readable caption. Wider screens show three evenly spaced photographs.

## Earlier Product-Photo Opening

The earlier opening used existing PureForm catalog photography, not stock media
or generated lifestyle scenes. Images are contained without cropping.

- Grey: `../pureform-back-scrubber.webp`, the existing transparent four-piece set.
- Pink: `pink-set.webp`, a bounded WebP delivery of the same transparent Pink
  set already used in the public catalog. No image content was changed.

Pink original:
https://res.cloudinary.com/dqjilscgl/image/upload/v1780227618/main_img_without_bg_mbrxsg.png

Pink optimized delivery:
https://res.cloudinary.com/dqjilscgl/image/upload/f_webp,q_82,c_limit,w_640/v1780227618/main_img_without_bg_mbrxsg.png

Both are decorative references in the opening, not a replacement for live
admin-managed product listings. The animation never displays prices or stock.
