# FixedBar.js

## Basic usage

### HTML

```html
<!-- In <head> -->
<link rel="stylesheet" href="your-path/fixed-bar.css">

...

<!-- In <body> -->
<div
  id="bar"
  aria-live="polite"
  aria-atomic="true"
  hidden
>
  Content...
  <button id="bar-closer">Close</button>
</div>

...

<section data-fixed-bar-range>
  This section is a targeted range.
</section>

...

<script src="your-path/fixed-bar.min.js"></script>
```

### JavaScript

```js
const fixedBar = new FixedBar({
  bar: '#bar',
  range: '[data-fixed-bar-range]',
});

// Close button
const closer = document.querySelector('#bar-closer');
closer.addEventListener('click', () => {
  fixedBar.close();
})
```

## Options

### `bar` {string}

対象要素のセレクタ。要素が複数ある場合は、最初に見つかった要素が対象になる。

### `range` {string}

表示させたい領域となる要素のセレクタ。

### `reverse` {boolean}

`true`を設定すると、`range`で指定した要素が出現したときは非表示に、それ以外のときは表示するように変更する。

## Methods

### close(time)

強制的に非表示状態にする。

#### `time` {number} default = `0`

指定したミリ秒後に、スクロールに応じた表示・非表示が再びアクティブとなる。

### freeze(isExpanded)

表示・非表示を指定してその状態に固定する。

#### `isExpanded` {boolean} default = `true`

`true`なら表示、`false`なら非表示となる。

### restart()

`freeze()`で固定した状態を解除する。
