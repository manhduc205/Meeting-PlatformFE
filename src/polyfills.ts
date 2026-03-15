// SockJS/StompJS tham chiếu biến global theo kiểu Node.js.
// Gán lên globalThis để cả mã browser và bundle runtime đều nhìn thấy.
const browserGlobal = globalThis as typeof globalThis & { global?: typeof globalThis };

if (!browserGlobal.global) {
	browserGlobal.global = browserGlobal;
}
