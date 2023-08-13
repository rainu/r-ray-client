# r-ray-client
The js client for [r-ray](https://github.com/rainu/r-ray) proxy.

# Usage

```shell
npm install @rainu/r-ray-client
```

```js
import {client} from '@rainu/r-ray-client'

client(`https://proxy.example.com`).fetch(`https://github.com`)
```
