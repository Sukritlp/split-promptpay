/** แสดงระหว่างรอรู้สถานะการล็อกอิน — กันเนื้อหาผิดหน้ากระพริบให้เห็น */
export function PageLoading() {
  return (
    <div role="status" className="py-12 text-center text-sm text-gray-500">
      กำลังโหลด…
    </div>
  );
}
