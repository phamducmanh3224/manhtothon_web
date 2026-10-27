# manhtothon.online – Website trưng bày link affiliate

Web tĩnh (HTML + CSS + JS), không cần server hay database. Host miễn phí trên Vercel, Netlify, Cloudflare Pages hoặc GitHub Pages.

## Cấu trúc
- `index.html` – trang chính
- `admin.html` – trang thêm/sửa sản phẩm (chỉ chạy trên trình duyệt của bạn, không ai sửa được dữ liệu web)
- `data/products.json` – **toàn bộ dữ liệu**: video theo phần + sản phẩm
- `assets/` – giao diện và code

## Thêm sản phẩm mới
1. Mở `manhtothon.online/admin.html`
2. Điền Phần, Ảnh số, tên, link ảnh, link Shopee affiliate, size, khoảng chiều cao / cân nặng hợp mặc, bảng size (để web gợi ý size)
3. Bấm **Tải products.json**, rồi upload đè file `data/products.json` trên GitHub → web tự cập nhật sau ~1 phút

Hoặc sửa thẳng `data/products.json`. Mỗi sản phẩm:
```json
{
  "id": "p105-01", "part": 105, "look": 1,
  "name": "Áo thun boxy đen", "category": "ao", "gender": "nam",
  "price": 129000, "image": "https://...jpg",
  "shopee": "https://s.shopee.vn/...",
  "sizes": ["M", "L"],
  "fit": { "height": [160, 178], "weight": [50, 68] },
  "sizeChart": [
    { "size": "M", "height": [160, 170], "weight": [50, 60] },
    { "size": "L", "height": [168, 178], "weight": [58, 68] }
  ],
  "style": ["basic", "đi học"]
}
```
- `category`: `ao` | `quan` | `giay` | `phukien`
- `gender`: `nam` | `nu` | `unisex`
- `sizeChart`: không bắt buộc; có thì web tự gợi ý size khi người xem nhập chiều cao, cân nặng
- `fit`: để `null` nếu không phụ thuộc dáng người (giày, phụ kiện)

## Link nhanh cho video
- `manhtothon.online/#phan-104` mở thẳng Phần 104
- `manhtothon.online/?q=quan+jeans` mở sẵn từ khoá tìm kiếm

## Chạy thử trên máy
`python3 -m http.server` trong thư mục này rồi mở http://localhost:8000

## Deploy lên manhtothon.online (Vercel)
1. Đưa thư mục này lên một repo GitHub
2. vercel.com → Add New Project → chọn repo → Deploy (không cần cấu hình build)
3. Project → Settings → Domains → thêm `manhtothon.online` và `www.manhtothon.online`
4. Ở nơi mua tên miền, thêm bản ghi DNS Vercel đưa ra (thường là `A @ 76.76.21.21` và `CNAME www cname.vercel-dns.com`)

## Tính năng
- Khung "Hôm nay mặc gì?": người xem gõ kiểu "1m70, 60kg đi học mặc gì?" → web tự hiểu chiều cao, cân nặng, giới tính, dịp (đi học, hẹn hò, đi làm, trời lạnh...) và gợi ý outfit. Dịp lấy từ trường `style` trong dữ liệu, nên muốn thêm dịp mới chỉ cần gắn style cho video/sản phẩm
- Tìm theo tên (gõ không dấu cũng ra) hoặc số phần; lọc Áo/Quần/Giày/Phụ kiện; sắp xếp theo giá
- Dải "Video mới" ở trang chủ; mỗi phần có nút Chia sẻ link
- Lọc theo dáng người (giới tính, chiều cao, cân nặng, size), tự gợi ý size và "Outfit hợp dáng bạn"
- Bấm vào sản phẩm: ảnh lớn, bảng size, các món "Cùng bộ trong video"
- Lưu sản phẩm yêu thích (lưu trên máy người xem)

## Sau này (dữ liệu đã chuẩn bị sẵn)
- Gợi ý outfit theo chiều cao/cân nặng/style: dùng `fit`, `style`, `look` (các món cùng `part` + `look` là một bộ)
- Thông tin người mẫu trong mỗi video: `videos[].model`
