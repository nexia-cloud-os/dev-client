# Nexia Developer Client

Nexia Core의 개발자 플랫폼 제공 여부와 기능을 조회하는 작은 원격 클라이언트입니다. Node.js 22 이상 ESM이며 별도 빌드가 없습니다. 기존 PHP App SDK나 React host SDK를 대체하지 않으며 Core 내부 코드를 의존하지 않습니다. 초기 버전은 실험적 alpha이며 npm의 `alpha` 태그로 배포합니다.

```js
import { createNexiaClient, NexiaClientError } from '@nexia/dev-client';

const client = createNexiaClient({ endpoint: 'https://your-nexia.example' });
try {
  const platform = await client.discover();
  console.log(platform.capabilities);
} catch (error) {
  if (error instanceof NexiaClientError) console.error(error.code, error.message);
  else throw error;
}
```

`endpoint`는 Core 원점 주소입니다. 하위 API 경로, URL 사용자명·비밀번호, query와 fragment를 허용하지 않습니다. 로컬 개발에서는 `createNexiaClient({ endpoint: 'http://localhost:8000', allowInsecureLoopback: true })`로 HTTP를 명시적으로 허용할 수 있습니다. 이는 localhost·127.0.0.0/8·::1에만 적용됩니다.

`discover()`는 `/.well-known/nexia-developer-platform`에서 JSON을 읽고 프로토콜 버전 `1`, experimental 상태, 다섯 capability boolean, authentication.methods 문자열 배열을 검사합니다. 기능이 모두 false인 응답도 정상적인 발견 결과이며 실행 기능이 준비되었다는 뜻은 아닙니다. 미래의 추가 응답 필드는 허용하지만 지원하지 않는 프로토콜 버전은 거절합니다.

요청은 GET, credentials omit, redirect error이며 10초 제한을 둡니다. 쿠키나 토큰을 전달하지 않습니다. 선택적인 `fetch`에는 표준 Fetch와 동일한 redirect·credentials·AbortSignal 동작을 제공하는 구현을 사용해야 합니다. 인증, 프로젝트 생성, 원격 개발, Resource 데이터 호출, 배포와 Functions API는 아직 제공하지 않습니다.

오류는 `NexiaClientError`이며 `code`, 필요한 경우 `status`, 원래 오류 `cause`를 제공합니다. code는 `INVALID_ENDPOINT`, `INVALID_FETCH`, `DISCOVERY_NETWORK`, `DISCOVERY_REDIRECT`, `DISCOVERY_HTTP`, `INVALID_DISCOVERY` 중 하나입니다.

## 로컬 연결과 검증

프로토콜 패키지 의존성은 `@nexia/dev-protocol`의 `0.1.0-alpha.1`입니다. npm registry 배포 이후에는 `npm install`로 설치합니다. 로컬 패키지로 연결하려면 먼저 `../protocol`에서 `npm test`와 `npm pack`을 실행하고, 여기에서 생성된 tarball을 `npm install --workspaces=false --no-save --package-lock=false /absolute/path/to/protocol.tgz`로 설치합니다. 이어 `npm test`로 통신 계약을 검증하고 `npm pack`으로 CLI용 로컬 배포물을 만듭니다. 이 작업은 npm publish와 다릅니다.

메타데이터의 `UNLICENSED`는 별도 오픈소스 사용권을 부여하지 않음을 뜻합니다. 공개 registry 게시와 사용권 부여는 별개입니다.
