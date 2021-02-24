module.exports = {
  plugins: [
    require('autoprefixer'),
    require('css-byebye')({rulesToRemove: [
     'hr', 'iframe', 'table', 'code', 'pre code',
      /\.hero-video.*/, /\.has-background-.*/,
      /\.hero\.is-(info|success|link|small|(full|half)height).*/,
      /\.hero-(body|buttons).*/,
      /\.columns\.is-(mobile|light|desktop|multiline|gapless|vcentered).*/,
      /\.column\.is-[^h].*/,
      /\.column\.is-half-.*/,
      /\.is-flex.*/,
      /.*is-medium.*/,
      /.*subtitle.*/,
      /.*is-(white|black|dark|warning|variable|primary).*/,
      /\.button\.is-info.*/,
      /\.modal-card.*/,
      /\.field-(label|body).*/,
      /.*has-icons-left.*/
    ], map: false}),
    require('postcss-discard-empty')
  ]
};
