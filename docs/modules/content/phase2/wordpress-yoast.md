# เปิดช่อง Yoast ให้ระบบเขียนได้ (ทำครั้งเดียว · 3 นาที)

ทำไมต้องทำ: Yoast ไม่เปิดช่อง meta description กับคำค้นหลักให้ระบบภายนอกเขียน
ถ้าไม่ทำ ระบบยังส่งบทความเป็น Draft ได้ตามปกติ แต่ต้องคัดลอก meta description ไปวางในกล่อง Yoast เอง

เว็บมีปลั๊กอิน **Code Snippets** ติดตั้งอยู่แล้ว ใช้ตัวนี้

1. เปิด https://chawcher.com/wp-admin/admin.php?page=add-snippet
2. ช่อง **Title**: `Chaw Cher OS · เปิดช่อง Yoast`
3. ช่อง Code (แบบ PHP) วางข้อความด้านล่างทั้งหมด

```php
add_action('init', function () {
    foreach (['_yoast_wpseo_metadesc', '_yoast_wpseo_focuskw'] as $key) {
        register_post_meta('post', $key, [
            'show_in_rest'  => true,
            'single'        => true,
            'type'          => 'string',
            'auth_callback' => function () { return current_user_can('edit_posts'); },
        ]);
    }
});
```

4. เลือก **Run snippet everywhere**
5. กด **Save Changes and Activate**
6. กลับมาที่ Chaw Cher OS → แบรนด์ → เชื่อมต่อ → กด **ทดสอบ** ต้องขึ้น "✓ ช่อง Yoast เปิดแล้ว"

ปลอดภัยไหม: เปิดให้เฉพาะคนที่แก้บทความได้อยู่แล้ว (`edit_posts`) เขียนสองช่องนี้ ไม่เปิดให้คนทั่วไป
