# QA 리포트: 빌드 경로 문제 수정

**날짜**: 2026-04-13 11:00
**마일스톤**: MCP Michelin Guide 서버 빌드 경로 문제 수정
**상태**: PASS
**프로젝트 유형**: API (MCP Server, CLI-only)

## 평가 점수

| 평가 축 | 점수 | 기준 | 판정 |
|---------|------|------|------|
| Functionality (기능 완성도) | 5/5 | >= 4 | PASS |
| Spec Fidelity (스펙 충실도) | 5/5 | >= 4 | PASS |
| User Experience (사용자 경험) | 4/5 | >= 4 | PASS |
| Edge Cases (경계 조건) | 4/5 | >= 3 | PASS |
| Design Quality (디자인 품질) | N/A | N/A | N/A (API-only) |

## 요약

| 카테고리 | 테스트 | 성공 | 실패 |
|----------|--------|------|------|
| 기능 테스트 | 12 | 12 | 0 |
| 입력 검증 | 5 | 5 | 0 |
| 에러 처리 | 3 | 3 | 0 |
| 보안 검증 | 2 | 2 | 0 |
| 스펙 충실도 | 6 | 6 | 0 |
| 사용자 경험 | 3 | 3 | 0 |
| **합계** | **31** | **31** | **0** |

## 스펙 충실도 체크리스트

팀 리드가 지정한 6가지 테스트 시나리오를 기준으로 검증:

| # | 요구사항 | 구현 여부 | 동작 확인 | 비고 |
|---|---------|----------|----------|------|
| 1 | `npm run build` 에러 0 | PASS | PASS | `rm -rf build && npm run build` — tsc 에러 없음, build/ 구조 정상 |
| 2 | `node build/index.js` 서버 시작 | PASS | PASS | 프로세스 정상 시작, stderr 비어있음, 2초 이상 안정 실행 |
| 3 | JSON-RPC tools/list 3개 도구 확인 | PASS | PASS | search_restaurants, get_restaurant_detail, search_latest_info 확인 |
| 4 | search_restaurants 도구 호출 | PASS | PASS | 7개 시나리오 (도시, 국가, FTS, 페이지네이션, 가격대 등) 전부 정상 |
| 5 | `npm run setup` DB 재생성 | PASS | PASS | CSV 다운로드(16,473KB) -> 18,908건 파싱 -> DB 삭제 후 재생성 |
| 6 | config 경로 일치 | PASS | PASS | `.mcp.json`: `build/index.js`, `~/.claude.json`: 절대경로 일치 |

## 테스트 결과

### PASS 기능 테스트

1. **npm run build: 컴파일**
   - 입력: `rm -rf build && npm run build`
   - 예상: 에러 0, build/index.js 생성
   - 실제: tsc 출력 깨끗, build/index.js, build/scripts/setup-data.js 등 8개 .js 파일 생성

2. **빌드 출력 구조 정상화**
   - 예상: `build/index.js` (flat 구조, `build/src/index.js` 아님)
   - 실제: rootDir=./src 변경으로 `build/index.js` 경로 정상

3. **MCP 서버 시작**
   - 입력: `node build/index.js`
   - 예상: 프로세스 시작, stderr 비어있음
   - 실제: pid 할당, stderr empty, 2초 안정 실행

4. **JSON-RPC initialize**
   - 입력: `{"jsonrpc":"2.0","id":1,"method":"initialize",...}`
   - 예상: protocolVersion, serverInfo 응답
   - 실제: `{ serverInfo: { name: "michelin-guide", version: "1.0.0" } }` 정상

5. **JSON-RPC tools/list**
   - 예상: 3개 도구
   - 실제: search_restaurants, get_restaurant_detail, search_latest_info 등록 확인

6. **search_restaurants: Tokyo 3 Stars**
   - 입력: `{ city: "Tokyo", award: "3 Stars" }`
   - 실제: total=11, 첫 결과: Azabu Kadowaki

7. **search_restaurants: FTS "sushi"**
   - 입력: `{ query: "sushi" }`
   - 실제: total=572, 페이지네이션 정상 (totalPages=29)

8. **search_restaurants: 페이지네이션**
   - 입력: `{ country: "Japan", page: 2 }`
   - 실제: total=1114, page=2, 첫 결과: Akasaka Kikunoi (2 Stars)

9. **search_restaurants: Bib Gourmand Italy**
   - 입력: `{ country: "Italy", award: "Bib Gourmand" }`
   - 실제: total=256

10. **get_restaurant_detail: 이름 검색 (다중 매칭)**
    - 입력: `{ name: "Jiro" }`
    - 실제: 10개 매칭 레스토랑 목록 반환 (Sushi Murakami Jiro 등)

11. **npm run setup: DB 재생성**
    - 실제: CSV 다운로드 16,473KB -> 18,908건 파싱 -> 기존 DB 삭제 -> 18,908건 삽입 -> DB 경로 `/data/michelin.db`

12. **DB 재생성 후 서버 동작**
    - 입력: `{ city: "Seoul", award: "3 Stars" }`
    - 실제: total=1, 결과: Mingles

### PASS 입력 검증

13. **SQL injection 차단**
    - 입력: `{ city: "'; DROP TABLE restaurants;--" }`
    - 실제: total=0, 크래시 없음 (parameterized query)

14. **XSS 시도**
    - 입력: `{ query: "<script>alert(1)</script>" }`
    - 실제: total=0, 크래시 없음

15. **빈 문자열**
    - 입력: `{ query: "" }`
    - 실제: total=18908 (전체 반환, 정상 동작)

16. **매우 긴 이름 (5000자)**
    - 입력: `{ name: "A".repeat(5000) }`
    - 실제: `{ error: "No restaurant found matching the given name." }` 정상

17. **Enum 유효성 검증**
    - 입력: `{ award: "NotValid" }`
    - 실제: MCP SDK Zod 검증 에러 `-32602` (Invalid arguments) 정상 반환

### PASS 에러 처리

18. **get_restaurant_detail: 파라미터 없음**
    - 입력: `{}`
    - 실제: `{ error: "Either 'name' or 'url' must be provided." }` 명확한 에러 메시지

19. **존재하지 않는 도시**
    - 입력: `{ city: "Zzzznoexist999" }`
    - 실제: `{ total: 0, message: "No restaurants found matching the given criteria." }`

20. **존재하지 않는 레스토랑 이름**
    - 입력: `{ name: "AAAAA..." }`
    - 실제: `{ error: "No restaurant found matching the given name." }`

### PASS 보안 검증

21. **SQL injection: parameterized query**
    - SQLite `@param` 바인딩으로 injection 불가. 테스트 #13에서 확인.

22. **입력 유효성: Zod 스키마 검증**
    - 잘못된 enum 값 거부 (테스트 #17). 타입 불일치 자동 차단.

### PASS 사용자 경험

23. **에러 메시지 품질**
    - "Either 'name' or 'url' must be provided." -- 구체적이고 actionable
    - "No restaurants found matching the given criteria." -- 명확

24. **응답 스키마 일관성**
    - 모든 search 결과: `{ total, page, totalPages, results }` 일관된 구조
    - 0건: `message` 필드 추가
    - Detail: 단건이면 객체, 다건이면 `{ message, matches }` 구조

25. **Config 경로 일관성**
    - `.mcp.json`: `{ args: ["build/index.js"] }` -- 상대 경로
    - `~/.claude.json`: `{ args: ["/Users/anhyobin/dev/mcp-michelin-guide/build/index.js"] }` -- 절대 경로
    - `package.json` main: `build/index.js`
    - 3개 모두 동일한 빌드 엔트리포인트를 가리킴

## 사용자 경험 평가

- **MCP 도구 설명**: 3개 도구 모두 description이 명확하고, inputSchema가 Zod를 통해 자동 생성되어 정확
- **에러 메시지 품질**: 필수 파라미터 누락, 검색 결과 없음 등 모든 케이스에서 유용한 메시지 반환
- **응답 구조 일관성**: search 도구는 항상 `{ total, page, totalPages, results }` 구조를 사용
- **검색 전략**: exact match -> LIKE -> FTS5 순서로 최적의 결과 제공

## 디자인 품질 평가

N/A (API-only project -- MCP stdio 서버, 프론트엔드 없음)

## 검증 커맨드

```bash
# 1. 빌드
rm -rf build && npm run build

# 2. 서버 시작 확인
node -e "
const { spawn } = require('child_process');
const c = spawn('node', ['build/index.js'], { stdio: ['pipe','pipe','pipe'] });
setTimeout(() => { console.log('OK'); c.kill(); }, 2000);
"

# 3. tools/list 확인 (newline-delimited JSON-RPC)
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | node build/index.js

# 4. DB 재생성
npm run setup
```

## 결론

**권장사항**: PROCEED

빌드 경로 문제 수정이 정상적으로 완료되었습니다. 핵심 변경 사항:
- `tsconfig.json` rootDir을 `./src`로 변경하여 빌드 출력이 `build/src/index.js` 대신 `build/index.js`로 생성
- `setup-data.ts`를 `src/scripts/`로 이동하고 import 경로 수정
- `db.ts`와 `setup-data.ts`의 PROJECT_ROOT 로직을 새 빌드 구조에 맞게 수정

31개 테스트 전부 통과, CRITICAL/HIGH/MEDIUM/LOW 이슈 없음.
