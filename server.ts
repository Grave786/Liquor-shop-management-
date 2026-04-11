import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'path';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';

app.use(cors());
app.use(express.json());

// MongoDB Connection
const getMongoUri = () => {
  const envUri = (process.env.MONGO_URI || '').trim().replace(/^["']|["']$/g, '');

  if (!envUri) {
    throw new Error('Missing MONGO_URI. Set it in your .env file.');
  }

  if (envUri.startsWith('mongodb://') || envUri.startsWith('mongodb+srv://')) {
    return envUri;
  }

  throw new Error('Invalid MONGO_URI. It must start with mongodb:// or mongodb+srv://');
};

let MONGO_URI = '';
try {
  MONGO_URI = getMongoUri();
} catch (err: any) {
  console.error(err?.message || 'Invalid MongoDB configuration.');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });

// --- Schemas ---

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['super_admin', 'admin', 'manager', 'user', 'terminal'], default: 'user' },
  outletId: { type: String },
  displayName: { type: String },
  createdBy: { type: String }
});

const outletSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  managerId: { type: String },
  createdBy: { type: String },
  licenseNumber: { type: String },
  licenseValidUntil: { type: Date }
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  sku: { type: String, unique: true, sparse: true },
  unitPrice: { type: Number, required: true },
  description: { type: String }
});

const inventorySchema = new mongoose.Schema({
  productId: { type: String, required: true },
  outletId: { type: String, required: true },
  quantity: { type: Number, required: true, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});

const saleSchema = new mongoose.Schema({
  outletId: { type: String, required: true },
  userId: { type: String, required: true },
  items: [{
    productId: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }
  }],
  subtotal: { type: Number },
  discountType: { type: String, enum: ['amount', 'percent'] },
  discountValue: { type: Number },
  discountAmount: { type: Number },
  totalAmount: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

const transferSchema = new mongoose.Schema({
  fromOutletId: { type: String, required: true },
  toOutletId: { type: String, required: true },
  productId: { type: String, required: true },
  quantity: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending' },
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Outlet = mongoose.model('Outlet', outletSchema);
const Product = mongoose.model('Product', productSchema);
const Inventory = mongoose.model('Inventory', inventorySchema);
const Sale = mongoose.model('Sale', saleSchema);
const Transfer = mongoose.model('Transfer', transferSchema);

const generateSku = () => `SKU-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// --- Middleware ---

const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// --- Auth Routes ---

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const isSuperAdminEmail = email === "chungledurgeshchungle@gmail.com";
    
    const user = new User({
      email,
      password: hashedPassword,
      displayName: displayName || email.split('@')[0],
      role: isSuperAdminEmail ? 'super_admin' : 'user'
    });

    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error registering user' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'User not found' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: 'Invalid password' });

    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET);
    res.json({ token, user: { id: user._id, email: user.email, role: user.role, displayName: user.displayName, outletId: user.outletId } });
  } catch (err) {
    res.status(500).json({ message: 'Error logging in' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req: any, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ id: user._id, email: user.email, role: user.role, displayName: user.displayName, outletId: user.outletId });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user profile' });
  }
});

// --- API Routes ---

// Users
app.get('/api/users', authenticateToken, async (req: any, res: any) => {
  const role = req.user?.role;
  if (!['super_admin', 'admin'].includes(role)) {
    return res.status(403).json({ message: 'Unauthorized to view users' });
  }

  const filter: any = {};
  // Admins can only see the managers/users they created
  if (role === 'admin') {
    filter.createdBy = String(req.user.id);
    filter.role = { $in: ['manager', 'user'] };
  }

  const users = await User.find(filter, '-password');
  res.json(users.map(u => ({ uid: u._id, email: u.email, role: u.role, displayName: u.displayName, outletId: u.outletId })));
});

app.post('/api/users', authenticateToken, async (req: any, res) => {
  try {
    const { email, password, role, displayName, outletId } = req.body;
    const creatorRole = req.user.role;

    // Hierarchical validation
    if (creatorRole === 'super_admin') {
      // Super admin can create any role
    } else if (creatorRole === 'admin') {
      // Admin can only create manager, user, terminal
      if (['super_admin', 'admin'].includes(role)) {
        return res.status(403).json({ message: 'Admins cannot create super admins or other admins' });
      }
    } else {
      return res.status(403).json({ message: 'Unauthorized to create users' });
    }

    // Only super_admin can create an admin user
    if (role === 'admin' && creatorRole !== 'super_admin') {
      return res.status(403).json({ message: 'Only super admins can create admins' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      email,
      password: hashedPassword,
      role,
      displayName: displayName || email.split('@')[0],
      outletId,
      createdBy: String(req.user.id)
    });

    await user.save();
    res.status(201).json({ uid: user._id, email: user.email, role: user.role, displayName: user.displayName, outletId: user.outletId });
  } catch (err) {
    res.status(500).json({ message: 'Error creating user' });
  }
});

app.patch('/api/users/:id', authenticateToken, async (req: any, res) => {
  try {
    const creatorRole = req.user.role;
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    const newRole = req.body.role;
    if (newRole === 'admin' && creatorRole !== 'super_admin') {
      return res.status(403).json({ message: 'Only super admins can promote users to admin' });
    }

    // Hierarchical validation for updates
    if (creatorRole === 'super_admin') {
      // Super admin can update anyone
    } else if (creatorRole === 'admin') {
      // Admin can only update users they created
      if (String((targetUser as any).createdBy || '') !== String(req.user.id)) {
        return res.status(403).json({ message: 'Admins can only modify users they created' });
      }
      // Admin cannot update super admins or other admins
      if (['super_admin', 'admin'].includes(targetUser.role)) {
        return res.status(403).json({ message: 'Admins cannot modify super admins or other admins' });
      }
      // Admin cannot promote someone to super_admin or admin
      if (newRole && ['super_admin', 'admin'].includes(newRole)) {
        return res.status(403).json({ message: 'Admins cannot promote users to admin or super admin' });
      }
    } else {
      return res.status(403).json({ message: 'Unauthorized to update users' });
    }

    if (req.body.password) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    }

    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ uid: user._id, email: user.email, role: user.role, displayName: user.displayName, outletId: user.outletId });
  } catch (err) {
    res.status(500).json({ message: 'Error updating user' });
  }
});

// Outlets
app.get('/api/outlets', authenticateToken, async (req, res) => {
  try {
    const role = (req as any).user?.role;
    const userId = String((req as any).user?.id || '');

    const filter: any = {};
    if (role === 'super_admin') {
      // super admin sees everything
    } else if (role === 'admin') {
      // admins only see outlets they created
      filter.createdBy = userId;
    } else {
      // managers/users/terminal only see their assigned outlet (or the outlet they manage)
      const actingUser = await User.findById(userId).select('outletId');
      const outletId = String((actingUser as any)?.outletId || '');

      if (!outletId) {
        // Allow manager visibility via managerId even without outletId set
        filter.managerId = userId;
      } else {
        filter.$or = [{ _id: outletId }, { managerId: userId }];
      }
    }

    const outlets = await Outlet.find(filter);
    res.json(outlets.map(o => ({
      id: o._id,
      name: o.name,
      location: o.location,
      managerId: o.managerId,
      licenseNumber: (o as any).licenseNumber,
      licenseValidUntil: (o as any).licenseValidUntil
    })));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/outlets', authenticateToken, async (req, res) => {
  try {
    if (!['super_admin', 'admin'].includes((req as any).user?.role)) {
      return res.status(403).json({ message: 'Unauthorized to create outlets' });
    }

    (req as any).body.createdBy = String((req as any).user?.id || '');

    const managerId = typeof req.body?.managerId === 'string' ? req.body.managerId.trim() : '';
    if (managerId) {
      const alreadyAssigned = await Outlet.findOne({ managerId });
      if (alreadyAssigned) {
        return res.status(409).json({ message: 'This manager is already assigned to another outlet' });
      }
      req.body.managerId = managerId;
    } else {
      req.body.managerId = null;
    }

    const outlet = new Outlet(req.body);
    await outlet.save();

    if (managerId) {
      await User.findByIdAndUpdate(managerId, { outletId: String(outlet._id) });
    }

    res.status(201).json({
      id: outlet._id,
      name: outlet.name,
      location: outlet.location,
      managerId: outlet.managerId,
      licenseNumber: (outlet as any).licenseNumber,
      licenseValidUntil: (outlet as any).licenseValidUntil
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.patch('/api/outlets/:id', authenticateToken, async (req, res) => {
  try {
    if (!['super_admin', 'admin'].includes((req as any).user?.role)) {
      return res.status(403).json({ message: 'Unauthorized to update outlets' });
    }

    const outlet = await Outlet.findById(req.params.id);
    if (!outlet) return res.status(404).json({ message: 'Outlet not found' });

    if ((req as any).user?.role === 'admin' && String((outlet as any).createdBy || '') !== String((req as any).user?.id || '')) {
      return res.status(403).json({ message: 'Admins can only modify outlets they created' });
    }

    const oldManagerId = (outlet as any).managerId as string | undefined;
    const nextManagerIdRaw = req.body?.managerId;
    const nextManagerId = typeof nextManagerIdRaw === 'string' ? nextManagerIdRaw.trim() : '';
    const managerIdToSet = nextManagerId || null;

    if (managerIdToSet && managerIdToSet !== oldManagerId) {
      const alreadyAssigned = await Outlet.findOne({ managerId: managerIdToSet, _id: { $ne: outlet._id } });
      if (alreadyAssigned) {
        return res.status(409).json({ message: 'This manager is already assigned to another outlet' });
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'name')) (outlet as any).name = req.body.name;
    if (Object.prototype.hasOwnProperty.call(req.body, 'location')) (outlet as any).location = req.body.location;
    if (Object.prototype.hasOwnProperty.call(req.body, 'managerId')) (outlet as any).managerId = managerIdToSet;
    if (Object.prototype.hasOwnProperty.call(req.body, 'licenseNumber')) (outlet as any).licenseNumber = req.body.licenseNumber || null;
    if (Object.prototype.hasOwnProperty.call(req.body, 'licenseValidUntil')) (outlet as any).licenseValidUntil = req.body.licenseValidUntil || null;

    await outlet.save();

    if (Object.prototype.hasOwnProperty.call(req.body, 'managerId')) {
      const outletIdString = String(outlet._id);
      if (oldManagerId && oldManagerId !== managerIdToSet) {
        await User.updateOne({ _id: oldManagerId, outletId: outletIdString }, { $unset: { outletId: '' } });
      }
      if (managerIdToSet) {
        await User.findByIdAndUpdate(managerIdToSet, { outletId: outletIdString });
      }
    }

    res.json({
      id: outlet._id,
      name: outlet.name,
      location: outlet.location,
      managerId: outlet.managerId,
      licenseNumber: (outlet as any).licenseNumber,
      licenseValidUntil: (outlet as any).licenseValidUntil
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/outlets/:id', authenticateToken, async (req, res) => {
  try {
    if (!['super_admin', 'admin'].includes((req as any).user?.role)) {
      return res.status(403).json({ message: 'Unauthorized to delete outlets' });
    }

    const outlet = await Outlet.findById(req.params.id);
    if (!outlet) return res.status(404).json({ message: 'Outlet not found' });

    if ((req as any).user?.role === 'admin' && String((outlet as any).createdBy || '') !== String((req as any).user?.id || '')) {
      return res.status(403).json({ message: 'Admins can only delete outlets they created' });
    }

    await Outlet.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Products
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products.map(p => ({ id: p._id, name: p.name, category: p.category, sku: p.sku, unitPrice: p.unitPrice, description: p.description })));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    if (typeof (req as any).body?.sku === 'string' && (req as any).body.sku.trim() === '') {
      delete (req as any).body.sku;
    }
    const skuWasProvided = Object.prototype.hasOwnProperty.call((req as any).body || {}, 'sku');

    const product = new Product(req.body);
    try {
      await product.save();
    } catch (err: any) {
      const isDupSku = err?.code === 11000 && (err?.keyPattern?.sku || err?.keyValue?.sku);
      if (!skuWasProvided && isDupSku) {
        (product as any).sku = generateSku();
        await product.save();
      } else {
        throw err;
      }
    }

    res.status(201).json({ id: product._id, name: product.name, category: product.category, sku: product.sku, unitPrice: product.unitPrice, description: product.description });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.patch('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    if (typeof (req as any).body?.sku === 'string' && (req as any).body.sku.trim() === '') {
      delete (req as any).body.sku;
    }
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ id: product._id, name: product.name, category: product.category, sku: product.sku, unitPrice: product.unitPrice, description: product.description });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Inventory
app.get('/api/inventory', authenticateToken, async (req, res) => {
  try {
    const { outletId } = req.query;
    const filter = outletId ? { outletId } : {};
    const inventory = await Inventory.find(filter);
    res.json(inventory.map(i => ({ id: i._id, productId: i.productId, outletId: i.outletId, quantity: i.quantity, lastUpdated: i.lastUpdated })));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/inventory', authenticateToken, async (req, res) => {
  try {
    const { productId, outletId, quantity } = req.body;
    let item = await Inventory.findOne({ productId, outletId });
    if (item) {
      item.quantity = quantity;
      item.lastUpdated = new Date();
    } else {
      item = new Inventory(req.body);
    }
    await item.save();
    res.status(201).json({ id: item._id, productId: item.productId, outletId: item.outletId, quantity: item.quantity, lastUpdated: item.lastUpdated });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// Sales
app.get('/api/sales', authenticateToken, async (req, res) => {
  try {
    const { outletId } = req.query;
    const filter = outletId ? { outletId } : {};
    const sales = await Sale.find(filter).sort({ timestamp: -1 });
    res.json(sales.map(s => ({
      id: s._id,
      outletId: s.outletId,
      userId: s.userId,
      items: s.items,
      subtotal: (s as any).subtotal,
      discountType: (s as any).discountType,
      discountValue: (s as any).discountValue,
      discountAmount: (s as any).discountAmount,
      totalAmount: s.totalAmount,
      timestamp: s.timestamp
    })));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/sales', authenticateToken, async (req: any, res: any) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const saleOutletId = req.body?.outletId;
    if (!saleOutletId) {
      throw new Error('outletId is required');
    }

    // Enforce outlet assignment for non-admin users
    if (!['super_admin', 'admin'].includes(req.user.role)) {
      const actingUser = await User.findById(req.user.id).select('outletId').session(session);
      if (!actingUser?.outletId) {
        return res.status(403).json({ message: 'User is not assigned to an outlet' });
      }
      if (actingUser.outletId !== saleOutletId) {
        return res.status(403).json({ message: 'Unauthorized outlet for this sale' });
      }
    }

    // Block sales for expired licenses (user/manager/terminal)
    const outlet = await Outlet.findById(saleOutletId).select('licenseValidUntil').session(session);
    const licenseValidUntil = (outlet as any)?.licenseValidUntil as Date | undefined;
    if (
      licenseValidUntil &&
      licenseValidUntil.getTime() < Date.now() &&
      ['manager', 'user', 'terminal'].includes(req.user.role)
    ) {
      return res.status(403).json({ message: 'Outlet license expired. Sales are disabled for this outlet.' });
    }

    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (rawItems.length === 0) {
      return res.status(400).json({ message: 'Sale items are required' });
    }

    const items = rawItems.map((it: any) => ({
      productId: String(it.productId || ''),
      quantity: Number(it.quantity),
      price: Number(it.price),
    }));

    for (const it of items) {
      if (!it.productId) return res.status(400).json({ message: 'Invalid productId in items' });
      if (!Number.isFinite(it.quantity) || it.quantity <= 0) return res.status(400).json({ message: 'Invalid quantity in items' });
      if (!Number.isFinite(it.price) || it.price < 0) return res.status(400).json({ message: 'Invalid price in items' });
    }

    const subtotal = items.reduce((sum: number, it: any) => sum + it.quantity * it.price, 0);

    const discountTypeRaw = String(req.body?.discountType || '').trim();
    const discountType = discountTypeRaw === 'percent' ? 'percent' : discountTypeRaw === 'amount' ? 'amount' : null;
    const discountValue = Number(req.body?.discountValue || 0);

    if (discountType && (!Number.isFinite(discountValue) || discountValue < 0)) {
      return res.status(400).json({ message: 'Invalid discount value' });
    }

    let discountAmount = 0;
    if (discountType === 'percent') {
      if (discountValue > 100) return res.status(400).json({ message: 'Discount percent cannot exceed 100' });
      discountAmount = (subtotal * discountValue) / 100;
    } else if (discountType === 'amount') {
      discountAmount = discountValue;
    }

    if (discountAmount > subtotal) {
      return res.status(400).json({ message: 'Discount cannot exceed subtotal' });
    }

    const totalAmount = subtotal - discountAmount;

    const sale = new Sale({
      outletId: saleOutletId,
      userId: String(req.body?.userId || req.user.id),
      items,
      subtotal,
      discountType: discountType || undefined,
      discountValue: discountType ? discountValue : undefined,
      discountAmount: discountType ? discountAmount : undefined,
      totalAmount,
    });
    await sale.save({ session });

    // Update inventory
    for (const item of sale.items) {
      const inv = await Inventory.findOne({ productId: item.productId, outletId: sale.outletId }).session(session);
      if (!inv || inv.quantity < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.productId}`);
      }
      inv.quantity -= item.quantity;
      inv.lastUpdated = new Date();
      await inv.save({ session });
    }

    await session.commitTransaction();
    res.status(201).json({
      id: sale._id,
      outletId: sale.outletId,
      userId: sale.userId,
      items: sale.items,
      subtotal: (sale as any).subtotal,
      discountType: (sale as any).discountType,
      discountValue: (sale as any).discountValue,
      discountAmount: (sale as any).discountAmount,
      totalAmount: sale.totalAmount,
      timestamp: sale.timestamp
    });
  } catch (err: any) {
    await session.abortTransaction();
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
});

app.post('/api/sales/:id/send-sms', authenticateToken, async (req: any, res: any) => {
  try {
    const saleId = String(req.params?.id || '').trim();
    const phoneNumber = String(req.body?.phoneNumber || '').trim().replace(/\s+/g, '');
    const customerName = String(req.body?.customerName || '').trim();

    if (!saleId) return res.status(400).json({ message: 'Sale id is required' });
    if (!/^\+\d{8,15}$/.test(phoneNumber)) {
      return res.status(400).json({ message: 'Invalid phone number. Use E.164 format, e.g. +14155552671' });
    }

    const sale = await Sale.findById(saleId);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });

    // Enforce outlet assignment for non-admin users
    if (!['super_admin', 'admin'].includes(req.user.role)) {
      const actingUser = await User.findById(req.user.id).select('outletId').exec();
      if (!actingUser?.outletId) return res.status(403).json({ message: 'User is not assigned to an outlet' });
      if (String(actingUser.outletId) !== String((sale as any).outletId)) {
        return res.status(403).json({ message: 'Unauthorized outlet for this sale' });
      }
    }

    const sid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
    const token = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
    const from = String(process.env.TWILIO_FROM_NUMBER || '').trim();
    if (!sid || !token || !from) {
      return res.status(501).json({
        message: 'SMS is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER in .env.'
      });
    }

    const ids = Array.from(new Set(((sale as any).items || []).map((it: any) => String(it.productId || '')).filter(Boolean)));
    const products = await Product.find({ _id: { $in: ids } }).select('name').exec();
    const productNameById = new Map<string, string>(products.map((p: any) => [String(p._id), String(p.name)]));

    const items = Array.isArray((sale as any).items) ? (sale as any).items : [];
    const preview = items.slice(0, 6).map((it: any) => {
      const name = productNameById.get(String(it.productId)) || 'Item';
      return `${name} x${Number(it.quantity || 0)}`;
    });
    const moreCount = Math.max(0, items.length - preview.length);

    const totalAmount = Number((sale as any).totalAmount || 0);
    const receiptId = String((sale as any)._id).slice(-6).toUpperCase();
    const dateStr = (() => {
      try {
        return new Date((sale as any).timestamp || Date.now()).toLocaleString();
      } catch {
        return '';
      }
    })();

    const bodyLines = [
      `LiquorLedger Receipt ${receiptId}`,
      dateStr ? `Date: ${dateStr}` : null,
      customerName ? `Customer: ${customerName}` : null,
      `Total: $${totalAmount.toFixed(2)}`,
      preview.length ? `Items: ${preview.join(', ')}${moreCount ? ` +${moreCount} more` : ''}` : null,
      'Thank you!',
    ].filter(Boolean);

    const messageBody = bodyLines.join('\n');

    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const params = new URLSearchParams({ To: phoneNumber, From: from, Body: messageBody });
    const twRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!twRes.ok) {
      const text = await twRes.text();
      return res.status(502).json({ message: `Failed to send SMS (${twRes.status}). ${text}` });
    }

    const data = await twRes.json();
    return res.json({ ok: true, sid: data?.sid });
  } catch (err: any) {
    return res.status(400).json({ message: err.message || 'Failed to send SMS' });
  }
});

// Transfers
app.get('/api/transfers', authenticateToken, async (req, res) => {
  try {
    const transfers = await Transfer.find().sort({ timestamp: -1 });
    res.json(transfers.map(t => ({ id: t._id, fromOutletId: t.fromOutletId, toOutletId: t.toOutletId, productId: t.productId, quantity: t.quantity, status: t.status, timestamp: t.timestamp })));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/transfers', authenticateToken, async (req, res) => {
  try {
    const transfer = new Transfer(req.body);
    await transfer.save();
    res.status(201).json({ id: transfer._id, fromOutletId: transfer.fromOutletId, toOutletId: transfer.toOutletId, productId: transfer.productId, quantity: transfer.quantity, status: transfer.status, timestamp: transfer.timestamp });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.patch('/api/transfers/:id', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const transfer = await Transfer.findById(req.params.id).session(session);
    if (!transfer) throw new Error('Transfer not found');

    const oldStatus = transfer.status;
    const newStatus = req.body.status;

    if (oldStatus === 'pending' && newStatus === 'completed') {
      // Deduct from source
      const fromInv = await Inventory.findOne({ productId: transfer.productId, outletId: transfer.fromOutletId }).session(session);
      if (!fromInv || fromInv.quantity < transfer.quantity) {
        throw new Error('Insufficient stock at source outlet');
      }
      fromInv.quantity -= transfer.quantity;
      await fromInv.save({ session });

      // Add to destination
      let toInv = await Inventory.findOne({ productId: transfer.productId, outletId: transfer.toOutletId }).session(session);
      if (!toInv) {
        toInv = new Inventory({ productId: transfer.productId, outletId: transfer.toOutletId, quantity: 0 });
      }
      toInv.quantity += transfer.quantity;
      await toInv.save({ session });
    }

    transfer.status = newStatus;
    await transfer.save({ session });

    await session.commitTransaction();
    res.json({ id: transfer._id, fromOutletId: transfer.fromOutletId, toOutletId: transfer.toOutletId, productId: transfer.productId, quantity: transfer.quantity, status: transfer.status, timestamp: transfer.timestamp });
  } catch (err: any) {
    await session.abortTransaction();
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
});

app.delete('/api/transfers/:id', authenticateToken, async (req: any, res: any) => {
  try {
    if (!['super_admin', 'admin', 'manager'].includes(req.user?.role)) {
      return res.status(403).json({ message: 'Unauthorized to delete transfers' });
    }

    const deleted = await Transfer.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Transfer not found' });
    return res.status(204).send();
  } catch (err: any) {
    return res.status(400).json({ message: err.message });
  }
});

// --- Vite Integration ---

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
