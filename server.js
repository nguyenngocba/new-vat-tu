const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const redis = require('redis');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://vattu.trivietsteel.local", "http://vattu.trivietsteel.com"],
    methods: ["GET", "POST"]
  }
});
const PORT = 3000;
// THÊM 3 DÒNG NÀY:
const { createClient } = require('redis');
const pubClient = createClient();
const subClient = pubClient.duplicate();
Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(require('@socket.io/redis-adapter').createAdapter(pubClient, subClient));
});


// Redis
const redisClient = redis.createClient();
redisClient.on('error', () => console.log('Redis: offline'));
redisClient.connect().catch(() => {});

// PostgreSQL
const pool = new Pool({ host: '/var/run/postgresql', database: 'steeltrack', user: 'postgres', port: 5432 });
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// Cache helpers
async function getCache(k) { try { return await redisClient.get(k); } catch(e) { return null; } }
async function setCache(k, v, t=30) { try { await redisClient.set(k, v, { EX: t }); } catch(e) {} }
async function clearCache() { try { await redisClient.del('api_data'); } catch(e) {} }

// WebSocket
io.on('connection', (socket) => {
    console.log('🔗 User connected:', socket.id);
});
function notifyAll(event, data) {
    io.emit(event, data);
}

// API
app.get('/api/data', async (req, res) => {
    try {
        const cached = await getCache('api_data');
        if (cached) return res.json(JSON.parse(cached));
        
        const m = await pool.query('SELECT * FROM materials');
        const t = await pool.query('SELECT * FROM transactions');
        const p = await pool.query('SELECT * FROM projects');
        const s = await pool.query('SELECT * FROM suppliers');
        const u = await pool.query('SELECT * FROM users_table');
        const l = await pool.query('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 200');
        const c = await pool.query('SELECT name FROM categories ORDER BY name');
        const un = await pool.query('SELECT name FROM units ORDER BY name');
        
	const ps = await pool.query('SELECT * FROM project_schedules');
	const pmu = await pool.query('SELECT * FROM project_material_usage');
	const st = await pool.query('SELECT * FROM structures');
        const stm = await pool.query('SELECT * FROM structure_materials');
        const result = { success: true, data: { materials: m.rows, transactions: t.rows, projects: p.rows, suppliers: s.rows, users: u.rows, logs: l.rows, categories: c.rows.map(r=>r.name), units: un.rows.map(r=>r.name), projectSchedules: ps.rows, projectMaterialUsage: pmu.rows, structures: st.rows, structureMaterials: stm.rows }};
        await setCache('api_data', JSON.stringify(result), 30);
        res.json(result);
    } catch (err) { res.json({ success: false, error: err.message }); }
});

app.post('/api/materials', async (req, res) => { 
    const m=req.body; 
    await pool.query('INSERT INTO materials VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO UPDATE SET name=$2,cat=$3,unit=$4,qty=$5,cost=$6,low=$7,note=$8',[m.id,m.name,m.cat,m.unit,m.qty,m.cost,m.low,m.note||'']); 
    await clearCache();
    notifyAll('dataChanged', { type: 'material', id: m.id });
    res.json({success:true}); 
});
app.delete('/api/materials/:id', async (req, res) => { 
    await pool.query('DELETE FROM materials WHERE id=$1',[req.params.id]); 
    await clearCache();
    notifyAll('dataChanged', { type: 'material_deleted' });
    res.json({success:true}); 
});

app.post('/api/transactions', async (req, res) => { 
    const t=req.body; 
    try {
        await pool.query('BEGIN');
        if (t.type === 'usage') {
            const stock = await pool.query('SELECT qty FROM materials WHERE id=$1 FOR UPDATE', [t.mid]);
            if (stock.rows[0] && parseFloat(stock.rows[0].qty) < parseFloat(t.qty)) {
                await pool.query('ROLLBACK');
                return res.json({ success: false, error: 'Không đủ tồn kho!' });
            }
        }
        await pool.query('INSERT INTO transactions VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',[t.id,t.mid,t.supplierId||'',t.projectId||'',t.date,t.datetime,t.type,t.qty,t.unitPrice,t.vatRate,t.subtotal,t.vatAmount,t.totalAmount,t.note,t.attachment,t.invoiceImage]); 
        if(t.type==='purchase') await pool.query('UPDATE materials SET qty=qty+$1 WHERE id=$2',[t.qty,t.mid]); 
        else if(t.type==='usage') await pool.query('UPDATE materials SET qty=qty-$1 WHERE id=$2',[t.qty,t.mid]); 
        else if(t.type==='return') await pool.query('UPDATE materials SET qty=qty+$1 WHERE id=$2',[t.qty,t.mid]); 
        await pool.query('COMMIT');
        await clearCache();
        notifyAll('dataChanged', { type: 'transaction', id: t.id });
        res.json({success:true}); 
    } catch(err) { 
        await pool.query('ROLLBACK');
        res.json({ success: false, error: err.message }); 
    }
});

app.post('/api/projects', async (req, res) => { const p=req.body; await pool.query('INSERT INTO projects VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET name=$2,budget=$3,spent=$4',[p.id,p.name,p.budget,p.spent]); await clearCache(); notifyAll('dataChanged', {}); res.json({success:true}); });
app.delete('/api/projects/:id', async (req, res) => { await pool.query('DELETE FROM projects WHERE id=$1',[req.params.id]); await clearCache(); notifyAll('dataChanged', {}); res.json({success:true}); });
app.post('/api/suppliers', async (req, res) => { const s=req.body; await pool.query('INSERT INTO suppliers VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET name=$2,phone=$3,email=$4,address=$5',[s.id,s.name,s.phone,s.email,s.address]); await clearCache(); notifyAll('dataChanged', {}); res.json({success:true}); });
app.delete('/api/suppliers/:id', async (req, res) => { await pool.query('DELETE FROM suppliers WHERE id=$1',[req.params.id]); await clearCache(); notifyAll('dataChanged', {}); res.json({success:true}); });
app.post('/api/users-table', async (req, res) => { const u=req.body; await pool.query('INSERT INTO users_table VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET name=$2,username=$3,password=$4,role=$5,permissions=$6',[u.id,u.name,u.username,u.password,u.role,u.permissions]); await clearCache(); res.json({success:true}); });
app.post('/api/users-table/delete', async (req, res) => { await pool.query('DELETE FROM users_table WHERE id=$1',[req.body.id]); await clearCache(); res.json({success:true}); });
app.post('/api/categories', async (req, res) => {
    try {
        await pool.query('BEGIN');
        await pool.query('DELETE FROM categories');
        for(const c of (req.body.categories||[])){
            await pool.query('INSERT INTO categories (name) VALUES ($1)',[c]);
        }
        await pool.query('COMMIT');
        await clearCache();
        res.json({success:true});
    } catch(e) {
        await pool.query('ROLLBACK');
        res.json({success:false});
    }
});

app.post('/api/units', async (req, res) => {
    try {
        await pool.query('BEGIN');
        await pool.query('DELETE FROM units');
        for(const u of (req.body.units||[])){
            await pool.query('INSERT INTO units (name) VALUES ($1)',[u]);
        }
        await pool.query('COMMIT');
        await clearCache();
        res.json({success:true});
    } catch(e) {
        await pool.query('ROLLBACK');
        res.json({success:false});
    }
});
app.post('/api/logs', async (req, res) => { const l=req.body; await pool.query('INSERT INTO logs (id,user_id,user_name,action,details) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET user_id=$2,user_name=$3,action=$4,details=$5',[l.id,l.userId,l.userName,l.action,l.details]); res.json({success:true}); });

// Upload file
const multer = require('multer');
const storage = multer.diskStorage({
    destination: (req, file, cb) => { const dir = '/var/www/steeltrack/uploads/' + (req.params.type||'purchase'); require('fs').mkdirSync(dir, { recursive: true }); cb(null, dir); },
    filename: (req, file, cb) => cb(null, req.params.id + '_' + Date.now() + require('path').extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 10*1024*1024 } });
app.post('/api/upload/:type/:id', upload.single('file'), (req, res) => {
    if (!req.file) return res.json({ success: false });
    res.json({ success: true, filename: req.file.filename, path: '/uploads/' + req.params.type + '/' + req.file.filename });
});
app.use('/uploads', express.static('/var/www/steeltrack/uploads'));
app.post('/api/project-schedules', async (req, res) => {
    const s = req.body;
    await pool.query('INSERT INTO project_schedules (project_id, data) VALUES ($1, $2) ON CONFLICT (project_id) DO UPDATE SET data=$2', [s.projectId, JSON.stringify(s)]);
    res.json({success:true});
});

app.post('/api/project-material-usage', async (req, res) => {
    const u = req.body;
    await pool.query('INSERT INTO project_material_usage (project_id, material_id, used_qty) VALUES ($1, $2, $3) ON CONFLICT (project_id, material_id) DO UPDATE SET used_qty=$3', [u.projectId, u.materialId, u.usedQty]);
    res.json({success:true});
});


// ========== CẤU KIỆN (BOM) ==========
app.get('/api/structures', async (req, res) => {
    try {
        const s = await pool.query('SELECT * FROM structures ORDER BY name');
        const m = await pool.query('SELECT * FROM structure_materials');
        res.json({ success: true, structures: s.rows, materials: m.rows });
    } catch(e) { res.json({ success: false, error: e.message }); }
});

app.post('/api/structures', async (req, res) => {
    const s = req.body;
    await pool.query('INSERT INTO structures (id, name, unit, qty, cost, note) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET name=$2, unit=$3, qty=$4, cost=$5, note=$6', [s.id, s.name, s.unit, s.qty, s.cost, s.note||'']);
    // Lưu BOM
    await pool.query('DELETE FROM structure_materials WHERE structure_id=$1', [s.id]);
    for (const m of (s.materials||[])) {
        await pool.query('INSERT INTO structure_materials (structure_id, material_id, material_name, unit, quantity) VALUES ($1,$2,$3,$4,$5)', [s.id, m.materialId, m.materialName, m.unit, m.quantity]);
    }
    await clearCache();
    res.json({ success: true });
});

app.delete('/api/structures/:id', async (req, res) => {
    await pool.query('DELETE FROM structures WHERE id=$1', [req.params.id]);
    await pool.query('DELETE FROM structure_materials WHERE structure_id=$1', [req.params.id]);
    await clearCache();
    res.json({ success: true });
});

// Xuất sản xuất: trừ vật tư, cộng cấu kiện
app.post('/api/produce-structure', async (req, res) => {
    const { structureId, quantity } = req.body;
    try {
        await pool.query('BEGIN');
        const bom = await pool.query('SELECT * FROM structure_materials WHERE structure_id=$1', [structureId]);
        
        // Trừ từng vật tư từ KHO CẤU KIỆN
        for (const item of bom.rows) {
            const need = parseFloat(item.quantity) * quantity;
            const swStock = await pool.query('SELECT qty FROM structure_warehouse WHERE material_id=$1 FOR UPDATE', [item.material_id]);
            if (!swStock.rows[0] || parseFloat(swStock.rows[0].qty) < need) {
                await pool.query('ROLLBACK');
                return res.json({ success: false, error: 'Không đủ ' + item.material_name + ' trong kho cấu kiện! Cần ' + need + ', hiện có ' + (swStock.rows[0]?.qty||0) });
            }
            await pool.query('UPDATE structure_warehouse SET qty = qty - $1 WHERE material_id=$2', [need, item.material_id]);
        }
        // Cộng cấu kiện vào kho
        await pool.query('UPDATE structures SET qty = qty + $1 WHERE id=$2', [quantity, structureId]);
        // Ghi log giao dịch sản xuất
        const tid = 'tvskh' + new Date().toISOString().replace(/[-:T.Z]/g,'').slice(2,14) + '000';
        await pool.query('INSERT INTO transactions (id, mid, type, qty, total_amount, note, date, datetime) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', 
            [tid, structureId, 'produce', quantity, 0, 'Sản xuất cấu kiện', new Date().toISOString().split('T')[0], new Date().toISOString()]);
        await pool.query('COMMIT');
        await clearCache();
        res.json({ success: true });
    } catch(e) {
        await pool.query('ROLLBACK');
        res.json({ success: false, error: e.message });
    }
});


app.post('/api/export-structure', async (req, res) => {
    const { structureId, projectId, quantity, note } = req.body;
    try {
        await pool.query('BEGIN');
        // Kiểm tra tồn kho cấu kiện
        const stock = await pool.query('SELECT qty FROM structures WHERE id=$1 FOR UPDATE', [structureId]);
        if (!stock.rows[0] || parseFloat(stock.rows[0].qty) < quantity) {
            await pool.query('ROLLBACK');
            return res.json({ success: false, error: 'Không đủ cấu kiện trong kho!' });
        }
        // Lấy đơn giá cấu kiện
        const structure = await pool.query('SELECT cost FROM structures WHERE id=$1', [structureId]);
        const totalCost = parseFloat(structure.rows[0]?.cost || 0) * quantity;
        // Trừ tồn kho cấu kiện
        await pool.query('UPDATE structures SET qty = qty - $1 WHERE id=$2', [quantity, structureId]);
        // Ghi giao dịch xuất
        const tid = 'tvskh' + new Date().toISOString().replace(/[-:T.Z]/g,'').slice(2,14) + '000';
        await pool.query('INSERT INTO transactions (id, mid, project_id, type, qty, total_amount, note, date, datetime) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [tid, structureId, projectId, 'structure_export', quantity, totalCost, note || 'Xuất cấu kiện ra công trình', new Date().toISOString().split('T')[0], new Date().toISOString()]);
        // Cập nhật spent của project
        await pool.query('UPDATE projects SET spent = spent + $1 WHERE id=$2', [totalCost, projectId]);
        await pool.query('COMMIT');
        await clearCache();
        res.json({ success: true });
    } catch(e) {
        await pool.query('ROLLBACK');
        res.json({ success: false, error: e.message });
    }
});

// Chuyển vật tư từ kho chính sang kho cấu kiện
app.post('/api/transfer-to-structure-warehouse', async (req, res) => {
    const { items, note, structureWarehouse } = req.body;
    try {
        await pool.query('BEGIN');
        for (const item of items) {
            // Kiểm tra tồn kho chính
            const stock = await pool.query('SELECT qty FROM materials WHERE id=$1 FOR UPDATE', [item.mid]);
            if (!stock.rows[0] || parseFloat(stock.rows[0].qty) < item.qty) {
                await pool.query('ROLLBACK');
                return res.json({ success: false, error: `Không đủ ${item.name} trong kho chính!` });
            }
            // Trừ kho chính
            await pool.query('UPDATE materials SET qty = qty - $1 WHERE id=$2', [item.qty, item.mid]);
            // Cộng vào kho cấu kiện (dùng bảng structure_warehouse)
            await pool.query('INSERT INTO sw_logs (material_id, material_name, qty, unit, cost, note, attachment) VALUES ($1,$2,$3,$4,$5,$6,$7)',
                    [item.mid, item.name, item.qty, item.unit, item.cost||0, note, req.body.attachment || '[]']);
                await pool.query('INSERT INTO structure_warehouse (material_id, material_name, unit, qty, cost) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (material_id) DO UPDATE SET qty = structure_warehouse.qty + $4',
                [item.mid, item.name, item.unit, item.qty, item.cost || 0]);
            // Ghi log
            const tid = 'tvskh' + new Date().toISOString().replace(/[-:T.Z]/g,'').slice(2,14) + '000';
            await pool.query('INSERT INTO transactions (id, mid, type, qty, total_amount, note, date, datetime) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
                [tid, item.mid, 'transfer_sw', item.qty, 0, note || 'Chuyển sang kho cấu kiện', new Date().toISOString().split('T')[0], new Date().toISOString()]);
        }
        await pool.query('COMMIT');
        await clearCache();
        res.json({ success: true });
    } catch(e) {
        await pool.query('ROLLBACK');
        res.json({ success: false, error: e.message });
    }
});

// Lấy danh sách kho cấu kiện
app.get('/api/structure-warehouse', async (req, res) => {
    try {
        const items = await pool.query('SELECT * FROM structure_warehouse ORDER BY material_name');
        res.json({ success: true, data: items.rows });
    } catch(e) { res.json({ success: false, error: e.message }); }
});


// Trả về HTML options cho select vật tư kho CK
app.get('/api/sw-options', async (req, res) => {
    try {
        const items = await pool.query('SELECT * FROM structure_warehouse ORDER BY material_name');
        if (items.rows.length === 0) {
            return res.send('<option value="">⚠️ Kho CK trống!</option>');
        }
        var html = items.rows.map(function(m){
            return '<option value="' + m.material_id + '" data-unit="' + m.unit + '">' + m.material_name + ' (CK: ' + Number(m.qty).toLocaleString('vi-VN') + ' ' + m.unit + ')</option>';
        }).join('');
        res.send(html);
    } catch(e) { res.send('<option value="">Lỗi!</option>'); }
});


app.get('/api/sw-logs/:mid', async (req, res) => {
    try {
        const logs = await pool.query('SELECT * FROM sw_logs WHERE material_id=$1 ORDER BY created_at DESC', [req.params.mid]);
        res.json({ success: true, data: logs.rows });
    } catch(e) { res.json({ success: false, error: e.message }); }
});


app.post('/api/return-from-sw', async (req, res) => {
    const { material_id, qty } = req.body;
    try {
        await pool.query('BEGIN');
        const sw = await pool.query('SELECT * FROM structure_warehouse WHERE material_id=$1 FOR UPDATE', [material_id]);
        if (!sw.rows[0] || parseFloat(sw.rows[0].qty) < qty) {
            await pool.query('ROLLBACK');
            return res.json({ success: false, error: 'Không đủ số lượng trong kho CK!' });
        }
        await pool.query('UPDATE structure_warehouse SET qty = qty - $1 WHERE material_id=$2', [qty, material_id]);
        await pool.query('UPDATE materials SET qty = qty + $1 WHERE id=$2', [qty, material_id]);
        await pool.query('COMMIT');
        await clearCache();
        res.json({ success: true });
    } catch(e) { await pool.query('ROLLBACK'); res.json({ success: false, error: e.message }); }
});

server.listen(PORT, '0.0.0.0', () => console.log('OK'));
