# promptcage

[![npm package][npm-img]][npm-url]
[![Build Status][build-img]][build-url]
[![Issues][issues-img]][issues-url]
[![Code Coverage][codecov-img]][codecov-url]
[![Commitizen Friendly][commitizen-img]][commitizen-url]
[![Semantic Release][semantic-release-img]][semantic-release-url]

> Using this package requires an API key from [PromptCage.com](https://promptcage.com/)

## Install

```bash
npm install promptcage
```

## Usage

```ts
import { myPackage } from 'promptcage';

myPackage('hello world');
//=> 'hello world from my package'
```

## API

### myPackage(input, options?)

#### input

Type: `string`

#### options

Type: `object`

##### postfix

Type: `string`
Default: `rainbows`

[build-img]:https://github.com/devndeploy/promptcage/actions/workflows/release.yml/badge.svg
[build-url]:https://github.com/devndeploy/promptcage/actions/workflows/release.yml
[npm-img]:https://img.shields.io/npm/v/promptcage
[npm-url]:https://www.npmjs.com/package/promptcage
[issues-img]:https://img.shields.io/github/issues/devndeploy/promptcage
[issues-url]:https://github.com/devndeploy/promptcage/issues
[codecov-img]:https://codecov.io/gh/devndeploy/promptcage/branch/main/graph/badge.svg
[codecov-url]:https://codecov.io/gh/devndeploy/promptcage
[semantic-release-img]:https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg
[semantic-release-url]:https://github.com/semantic-release/semantic-release
[commitizen-img]:https://img.shields.io/badge/commitizen-friendly-brightgreen.svg
[commitizen-url]:http://commitizen.github.io/cz-cli/
