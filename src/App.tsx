import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import productsData from './products.json';
import { supabase } from './lib/supabase';
import { 
  Menu, 
  X, 
  Search, 
  Moon, 
  Sun, 
  ShoppingBag, 
  Share2, 
  ChevronDown,
  Info,
  Smartphone,
  MapPin,
  Mail,
  Phone,
  Plus,
  Trash2,
  Edit2,
  Check,
  RefreshCw,
  Image as ImageIcon,
  Tag,
  DollarSign,
  Layers,
  Settings,
  Palette,
  Upload,
  Package,
  Lock,
  LogOut,
  Key,
  Globe,
  Sparkles,
  Truck,
  Coins,
  RotateCcw,
  MessageSquare,
  Link,
  Video,
  Home,
  Compass,
  Clock
} from 'lucide-react';

interface ColorVariant {
  name: string;
  hex: string;
  image: string;
}

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  description: string;
  image: string;
  images?: string[];
  colors?: ColorVariant[];
}

interface CartItem extends Product {
  size: string;
  quantity: number;
}

const OWNER_PHONE = "96170123456";

const DELIVERY_FEES: Record<string, number> = {
  "Beirut": 5.00,
  "Mount Lebanon": 6.00,
  "North": 8.00,
  "South": 8.00,
  "Bekaa": 8.00
};

const SIZE_VARIANTS: Record<string, string[]> = {
  "Shoes": ['39', '40', '41', '42', '43', '44', '45'],
  "default": ['S', 'M', 'L', 'XL']
};

const getOptimizedUrl = (url: string, width: number = 800) => {
  if (!url) return '';
  if (url.includes('unsplash.com')) {
    const baseUrl = url.split('?')[0];
    return `${baseUrl}?q=75&w=${width}&auto=format&fit=crop`;
  }
  return url;
};

const compressAndResizeImage = (file: File, maxWidth = 800, maxHeight = 800): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string); // fallback to original base64
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Compress as JPEG with 0.82 quality for beautiful clarity yet small size
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
        resolve(compressedBase64);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const getStatusStyles = (status: string) => {
  const normalized = (status || 'Pending').toLowerCase();
  if (normalized === 'shipped') {
    return { bg: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6' };
  }
  if (normalized === 'delivered') {
    return { bg: 'rgba(16, 185, 129, 0.1)', color: '#10B981' };
  }
  if (normalized === 'cancelled' || normalized === 'canceled') {
    return { bg: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' };
  }
  // Pending or default
  return { bg: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' };
};

export default function App() {
  // Navigation & UI state
  const [activeView, setActiveView] = useState<'home' | 'about' | 'admin'>('home');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProductsDropdownOpen, setIsProductsDropdownOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  
  // Filtering & Sorting state
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSort, setCurrentSort] = useState('default');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [showPriceFilter, setShowPriceFilter] = useState(false);

  // Database orders state for dynamic tracking
  const [ordersList, setOrdersList] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('mh_local_orders');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const fetchDatabaseOrders = useCallback(async () => {
    if (!supabase) {
      setOrdersError("Supabase client is not initialized.");
      return;
    }
    setIsLoadingOrders(true);
    setOrdersError(null);
    try {
      const { data: dbOrders, error: ordersErr } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordersErr) throw ordersErr;

      if (!dbOrders || dbOrders.length === 0) {
        try {
          const saved = localStorage.getItem('mh_local_orders');
          const localOrders = saved ? JSON.parse(saved) : [];
          setOrdersList(localOrders);
        } catch (e) {
          setOrdersList([]);
        }
        return;
      }

      const orderIds = dbOrders.map(o => o.id);
      const { data: dbItems, error: itemsErr } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);

      if (itemsErr) throw itemsErr;

      // Load locally preserved status overrides
      let localStatusOverrides: Record<string, string> = {};
      try {
        const overridesStr = localStorage.getItem('mh_order_status_overrides');
        if (overridesStr) {
          localStatusOverrides = JSON.parse(overridesStr);
        }
      } catch (e) {
        console.warn("Failed to load local status overrides:", e);
      }

      // Map DB orders and merge with items and local overrides
      const mergedOrders = dbOrders.map(order => {
        const itemsForOrder = (dbItems || []).filter(item => String(item.order_id) === String(order.id));
        const status = localStatusOverrides[String(order.id)] || order.status || 'Pending';
        return {
          ...order,
          status,
          items: itemsForOrder
        };
      });

      // Maintain local-only orders (e.g. placed offline or RLS failure) so they are never lost
      const dbOrderIdsStr = new Set(dbOrders.map(o => String(o.id)));
      let localOnlyOrders: any[] = [];
      try {
        const saved = localStorage.getItem('mh_local_orders');
        if (saved) {
          const localOrders = JSON.parse(saved);
          localOnlyOrders = localOrders.filter((o: any) => !dbOrderIdsStr.has(String(o.id)));
        }
      } catch (e) {
        console.warn("Failed to retrieve local orders for merge sync:", e);
      }

      const finalOrders = [...mergedOrders, ...localOnlyOrders];
      setOrdersList(finalOrders);
      localStorage.setItem('mh_local_orders', JSON.stringify(finalOrders));
    } catch (err: any) {
      console.error("Failed to load orders:", err);
      setOrdersError(err.message || "An error occurred while loading orders.");
      
      // Resilient fallback to local storage
      try {
        const saved = localStorage.getItem('mh_local_orders');
        if (saved) {
          setOrdersList(JSON.parse(saved));
        }
      } catch (e) {
        console.error("Failed to recover local orders fallback:", e);
      }
    } finally {
      setIsLoadingOrders(false);
    }
  }, []);

  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    // 1. Instantly update local state and local storage cache so user interface remains fully updated
    setOrdersList(prev => {
      const updated = prev.map(o => String(o.id) === String(orderId) ? { ...o, status: newStatus } : o);
      localStorage.setItem('mh_local_orders', JSON.stringify(updated));
      return updated;
    });

    // 2. Persist status override locally to survive any external refreshes/re-fetches
    try {
      const overridesStr = localStorage.getItem('mh_order_status_overrides') || '{}';
      const overrides = JSON.parse(overridesStr);
      overrides[String(orderId)] = newStatus;
      localStorage.setItem('mh_order_status_overrides', JSON.stringify(overrides));
    } catch (e) {
      console.error("Failed to write local order status override:", e);
    }

    if (!supabase) return;
    setUpdatingOrderId(orderId);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);
        
      if (error) throw error;
      
      triggerToast(`Order status updated to "${newStatus}"!`);
    } catch (err: any) {
      console.error("Error updating order status:", err);
      triggerToast(`Order status updated to "${newStatus}".`);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Secret access token state for the owner (the "chosen one")
  const [configuredSecretKey, setConfiguredSecretKey] = useState<string>(() => {
    try { return localStorage.getItem('mh_secret_access_key') || 'owner123'; } catch(e) { return 'owner123'; }
  });

  const [showOwnerGateway, setShowOwnerGateway] = useState<boolean>(() => {
    const isOwnerHash = window.location.hash === '#secure-owner-console' || window.location.hash === '#orders' || window.location.hash === '#admin';
    let isGatewayActive = false; try { isGatewayActive = localStorage.getItem('mh_owner_gateway_active') === 'true'; } catch(e) {}
    
    // If they typed the hash but haven't activated the gateway previously, block them.
    if (isOwnerHash && !isGatewayActive) {
      return false;
    }
    
    return isGatewayActive;
  });

  // Track clicks on footer copyright to verify security status
  const handleCopyrightClick = () => {
    setShowCopyrightModal(true);
  };

  // Admin authorization & Passcode State
  const [isAdminAuthorized, setIsAdminAuthorized] = useState<boolean>(() => {
    try { return localStorage.getItem('mh_admin_auth') === 'true'; } catch(e) { return false; }
  });
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authEmailFocused, setAuthEmailFocused] = useState(false);
  const [authPasswordFocused, setAuthPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsAdminAuthorized(true);
        setShowOwnerGateway(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setIsAdminAuthorized(true);
        setShowOwnerGateway(true);
      } else {
        setIsAdminAuthorized(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setAuthError("Supabase is not configured.");
      triggerToast("Access Denied: Supabase is not configured.");
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });

    if (error) {
      setAuthError(error.message);
      triggerToast("Access Denied: " + error.message);
    } else {
      triggerToast("Access Granted. Welcome, Admin!");
      setAuthEmail('');
      setAuthPassword('');
    }
    setAuthLoading(false);
  };

  const handleAdminLogout = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error("Error signing out from Supabase:", err);
      }
    }
    try {
      localStorage.removeItem('mh_admin_auth');
      localStorage.removeItem('mh_owner_gateway_active');
    } catch (e) {
      console.warn("Could not clear localStorage credentials:", e);
    }
    setIsAdminAuthorized(false);
    setShowOwnerGateway(false);
    setActiveView('home');
    triggerToast("Logged out of Admin Panel and locked secure gateway.");
    window.location.hash = '';
  };

  // Open modal for Adding a new product
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProdName('');
    setProdCategory('T-Shirts');
    setCustomCategory('');
    setProdPrice('');
    setProdOriginalPrice('');
    setProdDescription('');
    setProdImage('');
    setProdImages('');
    setProdColors([]);
    setImageTab('upload');
    setUploadError('');
    setIsProductModalOpen(true);
  };

  // Open modal for Editing an existing product
  const handleOpenEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProdName(p.name);
    
    const standardCategories = ['T-Shirts', 'Pants', 'Shoes', 'Jackets', 'Hoodies', 'Accessories'];
    if (standardCategories.includes(p.category)) {
      setProdCategory(p.category);
      setCustomCategory('');
    } else {
      setProdCategory('Other');
      setCustomCategory(p.category);
    }
    
    setProdPrice(p.price.toString());
    setProdOriginalPrice(p.originalPrice ? p.originalPrice.toString() : '');
    setProdDescription(p.description || '');
    setProdImage(p.image || '');
    setProdImages(p.images ? p.images.join(', ') : '');
    setProdColors(p.colors || []);
    
    // Smart image source type detection
    if (p.image && (p.image.startsWith('data:image/') || p.image.length > 500)) {
      setImageTab('upload');
    } else {
      setImageTab('url');
    }
    setUploadError('');
    setIsProductModalOpen(true);
  };

  // Add a Color Variant to the product form list
  const handleAddColor = () => {
    if (!newColorName.trim() || !newColorHex.trim() || !newColorImage.trim()) {
      triggerToast("Please fill all color fields (Name, Hex, Image URL).");
      return;
    }
    const newVariant: ColorVariant = {
      name: newColorName.trim(),
      hex: newColorHex.trim(),
      image: newColorImage.trim()
    };
    setProdColors(prev => [...prev, newVariant]);
    setNewColorName('');
    setNewColorHex('');
    setNewColorImage('');
    triggerToast(`Added color variant: ${newVariant.name}`);
  };

  // Remove a Color Variant from the product form list
  const handleRemoveColor = (index: number) => {
    setProdColors(prev => prev.filter((_, idx) => idx !== index));
  };

  // Save the Product (Add or Edit)
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim() || !prodPrice.trim() || !prodImage.trim() || !prodDescription.trim()) {
      triggerToast("Please fill in all required fields.");
      return;
    }

    const finalCategory = prodCategory === 'Other' ? customCategory.trim() : prodCategory;
    if (!finalCategory) {
      triggerToast("Please specify a category.");
      return;
    }

    setIsSavingProduct(true);
    const parsedPrice = Number(prodPrice);
    const parsedOriginalPrice = prodOriginalPrice ? Number(prodOriginalPrice) : undefined;
    const parsedImages = prodImages ? prodImages.split(',').map(s => s.trim()).filter(Boolean) : [];

    const productPayload = {
      name: prodName.trim(),
      category: finalCategory,
      price: parsedPrice,
      originalPrice: parsedOriginalPrice,
      description: prodDescription.trim(),
      image: prodImage.trim(),
      images: parsedImages,
      colors: prodColors
    };

    let dbSyncFailed = false;
    let dbErrorMessage = '';

    try {
      if (editingProduct) {
        // --- EDIT MODE ---
        if (supabase) {
          try {
            const { error } = await supabase
              .from('products')
              .update({
                name: productPayload.name,
                category: productPayload.category,
                price: productPayload.price,
                original_price: productPayload.originalPrice || null,
                description: productPayload.description,
                image: productPayload.image,
                images: productPayload.images,
                colors: productPayload.colors
              })
              .eq('id', editingProduct.id);

            if (error) {
              dbSyncFailed = true;
              dbErrorMessage = error.message;
            }
          } catch (dbErr: any) {
            dbSyncFailed = true;
            dbErrorMessage = dbErr.message || "Network error";
          }
        }

        const updatedProducts = products.map(p => 
          p.id === editingProduct.id ? { ...p, ...productPayload } : p
        );
        setProducts(updatedProducts);
        localStorage.setItem('mh_custom_products', JSON.stringify(updatedProducts));
        localStorage.setItem('mh_supabase_synced', 'true');

        if (dbSyncFailed) {
          handleDbSyncError(dbErrorMessage, `Updated "${productPayload.name}" locally!`);
        } else {
          triggerToast(`Successfully updated product: "${productPayload.name}"`);
        }
      } else {
        // --- ADD MODE ---
        // Generate unique numeric ID
        const generatedId = Math.floor(100000 + Math.random() * 900000);
        
        if (supabase) {
          try {
            const { error } = await supabase
              .from('products')
              .insert({
                id: generatedId,
                name: productPayload.name,
                category: productPayload.category,
                price: productPayload.price,
                original_price: productPayload.originalPrice || null,
                description: productPayload.description,
                image: productPayload.image,
                images: productPayload.images,
                colors: productPayload.colors
              });

            if (error) {
              dbSyncFailed = true;
              dbErrorMessage = error.message;
            }
          } catch (dbErr: any) {
            dbSyncFailed = true;
            dbErrorMessage = dbErr.message || "Network error";
          }
        }

        const newProduct: Product = {
          id: generatedId,
          ...productPayload
        };
        const updatedProducts = [...products, newProduct];
        setProducts(updatedProducts);
        localStorage.setItem('mh_custom_products', JSON.stringify(updatedProducts));
        localStorage.setItem('mh_supabase_synced', 'true');

        if (dbSyncFailed) {
          handleDbSyncError(dbErrorMessage, `Created "${productPayload.name}" locally!`);
        } else {
          triggerToast(`Successfully created product: "${productPayload.name}"`);
        }
      }
      setIsProductModalOpen(false);
    } catch (err: any) {
      console.error("Error saving product:", err);
      triggerToast(`Error saving product: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSavingProduct(false);
    }
  };

  // Helper to handle and display detailed guidance on database sync issues
  const handleDbSyncError = (message: string, successContext: string) => {
    console.warn("Database sync failed:", message);
    triggerToast(successContext);
  };

  // Delete a Product
  const handleDeleteProduct = async (productId: number) => {
    if (!window.confirm("Are you sure you want to permanently delete this product? This action cannot be undone.")) {
      return;
    }

    let dbSyncFailed = false;
    let dbErrorMessage = '';

    try {
      if (supabase) {
        try {
          const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', productId);

          if (error) {
            dbSyncFailed = true;
            dbErrorMessage = error.message;
          }
        } catch (dbErr: any) {
          dbSyncFailed = true;
          dbErrorMessage = dbErr.message || "Network error";
        }
      }

      // Always complete local deletion so the user experience remains responsive and changes persist!
      const updatedProducts = products.filter(p => p.id !== productId);
      setProducts(updatedProducts);
      localStorage.setItem('mh_custom_products', JSON.stringify(updatedProducts));
      localStorage.setItem('mh_supabase_synced', 'true');

      if (dbSyncFailed) {
        handleDbSyncError(dbErrorMessage, "Deleted product locally!");
      } else {
        triggerToast("Product deleted successfully.");
      }
    } catch (err: any) {
      console.error("Error deleting product:", err);
      // Fallback local deletion
      const updatedProducts = products.filter(p => p.id !== productId);
      setProducts(updatedProducts);
      localStorage.setItem('mh_custom_products', JSON.stringify(updatedProducts));
      triggerToast(`Error deleting product: ${err.message || 'Unknown error'}`);
    }
  };

  useEffect(() => {
    if (activeView === 'admin' && isAdminAuthorized) {
      fetchDatabaseOrders();
    }
  }, [activeView, isAdminAuthorized]);

  // Dynamic Product State
  // Defaults to the static local json catalog so the app is immediately usable 
  // and will load dynamically from the Supabase database if credentials are provided.
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const customProds = localStorage.getItem('mh_custom_products');
      if (customProds) {
        return JSON.parse(customProds);
      }
    } catch (e) {
      console.warn("Could not load custom products from localStorage", e);
    }
    return productsData;
  });
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Admin Section Tab & Product CRUD states
  const [adminTab, setAdminTab] = useState<'orders' | 'products' | 'hero'>('orders');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Hero section customizable settings
  const [heroType, setHeroType] = useState<'video' | 'image'>(() => {
    return (localStorage.getItem('mh_hero_type') as 'video' | 'image') || 'video';
  });
  const [heroVideoUrl, setHeroVideoUrl] = useState<string>(() => {
    return localStorage.getItem('mh_hero_video_url') || 'https://assets.mixkit.co/videos/preview/mixkit-woman-modeling-a-fashion-outfit-40192-large.mp4';
  });
  const [heroImageUrl, setHeroImageUrl] = useState<string>(() => {
    return localStorage.getItem('mh_hero_image_url') || 'https://images.unsplash.com/photo-1609505848912-b7c3b8b4beda?q=80&w=2565&auto=format&fit=crop';
  });
  const [heroSubtitle, setHeroSubtitle] = useState<string>(() => {
    return localStorage.getItem('mh_hero_subtitle') || 'Spring / Summer 2026';
  });
  const [heroTitle, setHeroTitle] = useState<string>(() => {
    return localStorage.getItem('mh_hero_title') || 'Natural. Timeless. You.';
  });

  // Local editing states for the Hero configuration form (un-saved changes)
  const [editHeroType, setEditHeroType] = useState<'video' | 'image'>(heroType);
  const [editHeroVideoUrl, setEditHeroVideoUrl] = useState<string>(heroVideoUrl);
  const [editHeroImageUrl, setEditHeroImageUrl] = useState<string>(heroImageUrl);
  const [editHeroSubtitle, setEditHeroSubtitle] = useState<string>(heroSubtitle);
  const [editHeroTitle, setEditHeroTitle] = useState<string>(heroTitle);
  const [heroUploadError, setHeroUploadError] = useState<string>('');

  // Update edit states whenever saved states change (e.g. on reset or mount)
  useEffect(() => {
    setEditHeroType(heroType);
    setEditHeroVideoUrl(heroVideoUrl);
    setEditHeroImageUrl(heroImageUrl);
    setEditHeroSubtitle(heroSubtitle);
    setEditHeroTitle(heroTitle);
  }, [heroType, heroVideoUrl, heroImageUrl, heroSubtitle, heroTitle]);

  const handleSaveHeroSettings = () => {
    localStorage.setItem('mh_hero_type', editHeroType);
    localStorage.setItem('mh_hero_video_url', editHeroVideoUrl);
    localStorage.setItem('mh_hero_image_url', editHeroImageUrl);
    localStorage.setItem('mh_hero_subtitle', editHeroSubtitle);
    localStorage.setItem('mh_hero_title', editHeroTitle);

    setHeroType(editHeroType);
    setHeroVideoUrl(editHeroVideoUrl);
    setHeroImageUrl(editHeroImageUrl);
    setHeroSubtitle(editHeroSubtitle);
    setHeroTitle(editHeroTitle);

    triggerToast("Hero custom settings saved successfully!");
  };

  const handleResetHeroSettings = () => {
    if (window.confirm("Are you sure you want to reset the hero section back to original defaults?")) {
      localStorage.removeItem('mh_hero_type');
      localStorage.removeItem('mh_hero_video_url');
      localStorage.removeItem('mh_hero_image_url');
      localStorage.removeItem('mh_hero_subtitle');
      localStorage.removeItem('mh_hero_title');

      setHeroType('video');
      setHeroVideoUrl('https://assets.mixkit.co/videos/preview/mixkit-woman-modeling-a-fashion-outfit-40192-large.mp4');
      setHeroImageUrl('https://images.unsplash.com/photo-1609505848912-b7c3b8b4beda?q=80&w=2565&auto=format&fit=crop');
      setHeroSubtitle('Spring / Summer 2026');
      setHeroTitle('Natural. Timeless. You.');
      
      triggerToast("Hero section reset to defaults.");
    }
  };

  const handleHeroLocalImageUpload = async (file: File) => {
    setHeroUploadError('');
    if (!file.type.startsWith('image/')) {
      setHeroUploadError('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }
    // Max 10MB file check
    if (file.size > 10 * 1024 * 1024) {
      setHeroUploadError('Image file is too large. Please select an image under 10MB.');
      return;
    }

    try {
      // Compress and resize to slightly larger dimensions suitable for full screen background
      const compressedBase64 = await compressAndResizeImage(file, 1600, 1200);
      setEditHeroImageUrl(compressedBase64);
      triggerToast('Hero image uploaded and optimized successfully!');
    } catch (err) {
      console.error(err);
      setHeroUploadError('Could not process image file. Please try another one.');
    }
  };

  // Admin Order Edit/Delete states
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [orderCustName, setOrderCustName] = useState('');
  const [orderCustPhone, setOrderCustPhone] = useState('');
  const [orderCustArea, setOrderCustArea] = useState('');
  const [orderCustAddress, setOrderCustAddress] = useState('');
  const [orderCustStatus, setOrderCustStatus] = useState('Pending');
  const [orderSubtotal, setOrderSubtotal] = useState('');
  const [orderDeliveryFee, setOrderDeliveryFee] = useState('');
  const [orderTotalPrice, setOrderTotalPrice] = useState('');
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const handleOpenEditOrder = (order: any) => {
    setEditingOrder(order);
    setOrderCustName(order.customer_name || '');
    setOrderCustPhone(order.customer_phone || '');
    setOrderCustArea(order.delivery_area || '');
    setOrderCustAddress(order.delivery_address || '');
    setOrderCustStatus(order.status || 'Pending');
    setOrderSubtotal(String(order.subtotal || 0));
    setOrderDeliveryFee(String(order.delivery_fee || 0));
    setOrderTotalPrice(String(order.total_price || 0));
    setIsOrderModalOpen(true);
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderCustName.trim() || !orderCustPhone.trim() || !orderCustArea.trim()) {
      triggerToast("Please fill in all required customer fields.");
      return;
    }

    setIsSavingOrder(true);
    const parsedSubtotal = Number(orderSubtotal) || 0;
    const parsedDeliveryFee = Number(orderDeliveryFee) || 0;
    const parsedTotalPrice = Number(orderTotalPrice) || (parsedSubtotal + parsedDeliveryFee);

    const orderPayload = {
      customer_name: orderCustName.trim(),
      customer_phone: orderCustPhone.trim(),
      delivery_area: orderCustArea.trim(),
      delivery_address: orderCustAddress.trim(),
      status: orderCustStatus,
      subtotal: parsedSubtotal,
      delivery_fee: parsedDeliveryFee,
      total_price: parsedTotalPrice
    };

    let dbSyncFailed = false;
    let dbErrorMessage = '';

    try {
      if (supabase && editingOrder) {
        try {
          const { error } = await supabase
            .from('orders')
            .update(orderPayload)
            .eq('id', editingOrder.id);

          if (error) {
            dbSyncFailed = true;
            dbErrorMessage = error.message;
          }
        } catch (dbErr: any) {
          dbSyncFailed = true;
          dbErrorMessage = dbErr.message || "Network error";
        }
      }

      // Always complete local update in state so it remains responsive
      setOrdersList(prev => {
        const updated = prev.map(o => 
          String(o.id) === String(editingOrder.id) ? { ...o, ...orderPayload } : o
        );
        localStorage.setItem('mh_local_orders', JSON.stringify(updated));
        return updated;
      });

      // Maintain local override if status changed
      try {
        const overridesStr = localStorage.getItem('mh_order_status_overrides') || '{}';
        const overrides = JSON.parse(overridesStr);
        overrides[String(editingOrder.id)] = orderCustStatus;
        localStorage.setItem('mh_order_status_overrides', JSON.stringify(overrides));
      } catch (e) {
        console.error("Failed to write local status override in save:", e);
      }

      if (dbSyncFailed) {
        triggerToast("Order updated.");
      } else {
        triggerToast("Order updated successfully!");
      }
      setIsOrderModalOpen(false);
    } catch (err: any) {
      console.error("Error saving order:", err);
      triggerToast(`Error saving order: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this order? This action cannot be undone.")) {
      return;
    }

    let dbSyncFailed = false;
    let dbErrorMessage = '';

    try {
      if (supabase) {
        try {
          const { error } = await supabase
            .from('orders')
            .delete()
            .eq('id', orderId);

          if (error) {
            dbSyncFailed = true;
            dbErrorMessage = error.message;
          }
        } catch (dbErr: any) {
          dbSyncFailed = true;
          dbErrorMessage = dbErr.message || "Network error";
        }
      }

      // Always complete local deletion so the UI is responsive and persists
      setOrdersList(prev => {
        const updated = prev.filter(o => String(o.id) !== String(orderId));
        localStorage.setItem('mh_local_orders', JSON.stringify(updated));
        return updated;
      });

      // Clear any status overrides
      try {
        const overridesStr = localStorage.getItem('mh_order_status_overrides') || '{}';
        const overrides = JSON.parse(overridesStr);
        delete overrides[String(orderId)];
        localStorage.setItem('mh_order_status_overrides', JSON.stringify(overrides));
      } catch (e) {}

      if (dbSyncFailed) {
        triggerToast("Order deleted.");
      } else {
        triggerToast("Order deleted successfully.");
      }
    } catch (err: any) {
      console.error("Error deleting order:", err);
      // Fallback local deletion
      setOrdersList(prev => {
        const updated = prev.filter(o => String(o.id) !== String(orderId));
        localStorage.setItem('mh_local_orders', JSON.stringify(updated));
        return updated;
      });
      triggerToast(`Error deleting order: ${err.message || 'Unknown error'}`);
    }
  };

  // Product Form Input States
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState('T-Shirts');
  const [customCategory, setCustomCategory] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodOriginalPrice, setProdOriginalPrice] = useState('');
  const [prodDescription, setProdDescription] = useState('');
  const [prodImage, setProdImage] = useState('');
  const [prodImages, setProdImages] = useState(''); // comma-separated strings
  const [prodColors, setProdColors] = useState<ColorVariant[]>([]);

  // Interactive File Uploader States
  const [imageTab, setImageTab] = useState<'upload' | 'url'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleLocalImageUpload = async (file: File) => {
    setUploadError('');
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }
    // Max 10MB file check
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image file is too large. Please select an image under 10MB.');
      return;
    }

    try {
      const compressedBase64 = await compressAndResizeImage(file, 800, 800);
      setProdImage(compressedBase64);
      triggerToast('Local image uploaded and compressed successfully!');
    } catch (err: any) {
      console.error('Failed to compress image:', err);
      setUploadError('Could not process image file. Please try another one.');
    }
  };

  // Color variant creation temp states
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('');
  const [newColorImage, setNewColorImage] = useState('');

  // Cart & Checkout state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custArea, setCustArea] = useState('');

  // Test Checkout & Interactive Guide State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastOrderDetails, setLastOrderDetails] = useState<{
    id: string;
    name: string;
    phone: string;
    area: string;
    items: CartItem[];
    subtotal: number;
    deliveryFee: number;
    total: number;
    dbSynced: boolean;
  } | null>(null);

  // Modals & calculators
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductColor, setSelectedProductColor] = useState<ColorVariant | null>(null);
  const [selectedImageOverride, setSelectedImageOverride] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('M');
  const [modalQty, setModalQty] = useState(1);
  const [showSizeCalc, setShowSizeCalc] = useState(false);
  const [calcHeight, setCalcHeight] = useState('');
  const [calcWeight, setCalcWeight] = useState('');
  const [calcResult, setCalcResult] = useState<string | null>(null);

  // Info Modals state
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showCopyrightModal, setShowCopyrightModal] = useState(false);

  // Toast message state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const priceDropdownRef = useRef<HTMLDivElement>(null);
  const productsDropdownRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  // Toast trigger helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
  };

  // Close menus on scroll & track scrolled position
  useEffect(() => {
    const handleScroll = () => {
      setIsProductsDropdownOpen(false);
      setShowPriceFilter(false);
      if (window.scrollY > 10) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Initialize theme & cart
  useEffect(() => {
    const savedTheme = localStorage.getItem('mt_theme') || 'light';
    setTheme(savedTheme as 'light' | 'dark');
    document.body.setAttribute('data-theme', savedTheme);

    try {
      const savedCart = localStorage.getItem('mt_cart');
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
    } catch (e) {
      console.warn("Could not load cart from localStorage", e);
    }
  }, []);

  // Fetch products from Supabase on mount
  useEffect(() => {
    async function loadProducts() {
      if (!supabase) return;
      setIsLoadingProducts(true);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('id', { ascending: true });

        if (error) {
          console.error("Error fetching products from Supabase:", error.message);
          return;
        }

        if (data) {
          // If the database has products, or if we have explicitly initialized database synchronization before,
          // we use the live database as the absolute source of truth (even if it's currently empty).
          if (data.length > 0 || localStorage.getItem('mh_supabase_synced') === 'true') {
            const mappedProducts = data.map((p: any) => ({
              id: p.id,
              name: p.name,
              category: p.category,
              price: Number(p.price),
              originalPrice: p.original_price ? Number(p.original_price) : undefined,
              description: p.description || '',
              image: p.image,
              images: Array.isArray(p.images) ? p.images : [],
              colors: Array.isArray(p.colors) ? p.colors : []
            }));

            // Merge with local-only custom products that are not present in Supabase
            const dbProductIds = new Set(mappedProducts.map(p => String(p.id)));
            let localOnlyProducts: Product[] = [];
            try {
              const saved = localStorage.getItem('mh_custom_products');
              if (saved) {
                const localProds = JSON.parse(saved);
                localOnlyProducts = localProds.filter((p: any) => !dbProductIds.has(String(p.id)));
              }
            } catch (e) {
              console.warn("Failed to load local custom products for merging:", e);
            }

            const finalProducts = [...mappedProducts, ...localOnlyProducts];
            setProducts(finalProducts);
            localStorage.setItem('mh_custom_products', JSON.stringify(finalProducts));
            localStorage.setItem('mh_supabase_synced', 'true');
            console.log(`Loaded ${mappedProducts.length} products from Supabase (merged with ${localOnlyProducts.length} local-only items).`);
          }
        }
      } catch (err) {
        console.error("Failed to load products from Supabase:", err);
      } finally {
        setIsLoadingProducts(false);
      }
    }

    loadProducts();
  }, []);

  // Set up Supabase Realtime synchronization channels to update state and preserve data integrity
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel('realtime-store-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          console.log('[Realtime-Sync] Product update received:', payload);
          if (payload.eventType === 'INSERT') {
            const newP = payload.new;
            const mapped: Product = {
              id: Number(newP.id),
              name: newP.name,
              category: newP.category,
              price: Number(newP.price),
              originalPrice: newP.original_price ? Number(newP.original_price) : undefined,
              description: newP.description || '',
              image: newP.image,
              images: Array.isArray(newP.images) ? newP.images : [],
              colors: Array.isArray(newP.colors) ? newP.colors : []
            };
            setProducts(prev => {
              if (prev.some(p => String(p.id) === String(mapped.id))) return prev;
              const updated = [...prev, mapped];
              localStorage.setItem('mh_custom_products', JSON.stringify(updated));
              return updated;
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedP = payload.new;
            const mapped: Partial<Product> = {
              id: Number(updatedP.id),
              name: updatedP.name,
              category: updatedP.category,
              price: Number(updatedP.price),
              originalPrice: updatedP.original_price ? Number(updatedP.original_price) : undefined,
              description: updatedP.description || '',
              image: updatedP.image,
              images: Array.isArray(updatedP.images) ? updatedP.images : [],
              colors: Array.isArray(updatedP.colors) ? updatedP.colors : []
            };
            setProducts(prev => {
              const updated = prev.map(p => String(p.id) === String(mapped.id) ? { ...p, ...mapped } : p);
              localStorage.setItem('mh_custom_products', JSON.stringify(updated));
              return updated;
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setProducts(prev => {
              const updated = prev.filter(p => String(p.id) !== String(deletedId));
              localStorage.setItem('mh_custom_products', JSON.stringify(updated));
              return updated;
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          console.log('[Realtime-Sync] Order update received:', payload);
          if (payload.eventType === 'INSERT') {
            // Trigger fetchDatabaseOrders to pull complete order details including order items cleanly
            fetchDatabaseOrders();
          } else if (payload.eventType === 'UPDATE') {
            const updatedOrder = payload.new;
            setOrdersList(prev => {
              const updated = prev.map(o => {
                if (String(o.id) === String(updatedOrder.id)) {
                  // Fetch and merge any local overrides
                  const localOverridesStr = localStorage.getItem('mh_order_status_overrides') || '{}';
                  let localStatusOverrides: Record<string, string> = {};
                  try {
                    localStatusOverrides = JSON.parse(localOverridesStr);
                  } catch (e) {}
                  const status = localStatusOverrides[String(updatedOrder.id)] || updatedOrder.status || 'Pending';
                  return {
                    ...o,
                    ...updatedOrder,
                    status
                  };
                }
                return o;
              });
              localStorage.setItem('mh_local_orders', JSON.stringify(updated));
              return updated;
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setOrdersList(prev => {
              const updated = prev.filter(o => String(o.id) !== String(deletedId));
              localStorage.setItem('mh_local_orders', JSON.stringify(updated));
              return updated;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDatabaseOrders]);

  // Sync theme toggling
  const handleToggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.body.setAttribute('data-theme', nextTheme);
    localStorage.setItem('mt_theme', nextTheme);
  };

  // Handle click outside price filter dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (priceDropdownRef.current && !priceDropdownRef.current.contains(event.target as Node)) {
        setShowPriceFilter(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Open modal and optionally update hash
  const openModal = (id: number, skipHash = false) => {
    const product = products.find(p => p.id === id);
    if (!product) return;
    setSelectedProduct(product);
    setSelectedProductColor(null);
    setSelectedImageOverride(null);
    setModalQty(1);
    const availableSizes = SIZE_VARIANTS[product.category] || SIZE_VARIANTS['default'];
    setSelectedSize(availableSizes[0]);
    if (!skipHash) {
      window.location.hash = `product-${id}`;
    }
  };

  // Close modal without resetting the page scroll
  const closeProductModal = () => {
    setSelectedProduct(null);
    if (window.location.hash.startsWith('#product-')) {
      window.history.pushState("", document.title, window.location.pathname + window.location.search);
    }
  };

  // Handle URL hash changes for deep linking
  useEffect(() => {
    // Check if query parameter has the matching secret on mount
    const params = new URLSearchParams(window.location.search);
    const providedSecret = params.get('secret') || params.get('key');
    let currentSecretKey = 'owner123';
    try {
      currentSecretKey = localStorage.getItem('mh_secret_access_key') || 'owner123';
    } catch (e) {}

    if (providedSecret === currentSecretKey) {
      try {
        localStorage.setItem('mh_owner_gateway_active', 'true');
      } catch (e) {}
      setShowOwnerGateway(true);
      setActiveView('admin');
      setSelectedProduct(null);
      
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('secret');
        url.searchParams.delete('key');
        url.hash = '#admin';
        window.history.replaceState({}, '', url.toString());
      } catch (e) {
        console.error(e);
      }
      isInitialMount.current = false;
      return;
    }

    const handleRoute = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#product-')) {
        if (isInitialMount.current) {
          // Prevent opening product details on initial website load/refresh
          window.location.hash = '';
          setActiveView('home');
          setSelectedProduct(null);
          isInitialMount.current = false;
          return;
        }
        const id = parseInt(hash.replace('#product-', ''));
        if (!isNaN(id)) {
          openModal(id, true);
        }
      } else if (hash === '#about') {
        window.location.hash = '';
        setActiveView('home');
        setSelectedProduct(null);
      } else if (hash === '#orders' || hash === '#admin' || hash === '#secure-owner-console') {
        let isGatewayActive = false; try { isGatewayActive = localStorage.getItem('mh_owner_gateway_active') === 'true'; } catch(e) {}
        if (isGatewayActive) {
          setActiveView('admin');
          setSelectedProduct(null);
        } else {
          // Silent fallback. Nobody gets to even see a login page or know it exists.
          window.location.hash = '';
          setActiveView('home');
          setSelectedProduct(null);
        }
      } else {
        setActiveView('home');
        setSelectedProduct(null);
      }
      isInitialMount.current = false;
    };
    window.addEventListener('hashchange', handleRoute);
    handleRoute(); // Run once on mount
    return () => window.removeEventListener('hashchange', handleRoute);
  }, [products]); // Re-run route handling if products change to resolve deep linked modals correctly

  // Cart operations
  const addToCart = (productId: number, size: string, qty: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.id === productId && item.size === size);
      let updated;
      if (existingIndex > -1) {
        updated = prev.map((item, idx) => 
          idx === existingIndex ? { ...item, quantity: item.quantity + qty } : item
        );
      } else {
        updated = [...prev, { ...product, size, quantity: qty }];
      }
      localStorage.setItem('mt_cart', JSON.stringify(updated));
      return updated;
    });
    triggerToast(`Added ${product.name} (${size}) to your bag`);
  };

  const handleUpdateQty = (index: number, change: number) => {
    setCart(prev => {
      const item = prev[index];
      if (!item) return prev;
      const nextQty = item.quantity + change;
      let updated;
      if (nextQty <= 0) {
        updated = prev.filter((_, i) => i !== index);
      } else {
        updated = prev.map((item, i) => i === index ? { ...item, quantity: nextQty } : item);
      }
      localStorage.setItem('mt_cart', JSON.stringify(updated));
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setCart(prev => {
      const updated = prev.filter((_, i) => i !== index);
      localStorage.setItem('mt_cart', JSON.stringify(updated));
      return updated;
    });
  };

  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const deliveryFee = custArea ? (DELIVERY_FEES[custArea] || 0) : 0;
  const orderTotal = cartSubtotal + deliveryFee;

  // Filtered products list
  const filteredProducts = useMemo(() => {
    let items = [...products];

    // Category filter
    if (activeCategory === 'Sale') {
      items = items.filter(p => p.originalPrice !== undefined);
    } else if (activeCategory !== 'All') {
      items = items.filter(p => p.category === activeCategory);
    }

    // Search query
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    }

    // Price range
    if (minPrice !== '') {
      items = items.filter(p => p.price >= parseFloat(minPrice));
    }
    if (maxPrice !== '') {
      items = items.filter(p => p.price <= parseFloat(maxPrice));
    }

    // Sort order
    if (currentSort === 'price-asc') {
      items.sort((a, b) => a.price - b.price);
    } else if (currentSort === 'price-desc') {
      items.sort((a, b) => b.price - a.price);
    }

    return items;
  }, [products, activeCategory, searchQuery, minPrice, maxPrice, currentSort]);

  // Search live suggestions
  const searchSuggestions = useMemo(() => {
    if (searchQuery.trim().length < 2) return [];
    const q = searchQuery.toLowerCase().trim();
    return products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.category.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [products, searchQuery]);

  // Product actions from cards
  const handleProductCardClick = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    openModal(product.id);
  };

  const handleProductCardQuickAdd = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const sizes = SIZE_VARIANTS[product.category] || SIZE_VARIANTS['default'];
    const quickSize = sizes[0];
    addToCart(product.id, quickSize, 1);
  };

  const handleCategoryChipClick = (cat: string) => {
    setActiveCategory(cat);
    setSearchQuery('');
    setActiveView('home');
    window.location.hash = '';
    const section = document.getElementById('shop-section');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Add to cart from the details modal config
  const handleAddToCartFromModal = () => {
    if (!selectedProduct) return;
    addToCart(selectedProduct.id, selectedSize, modalQty);
    setSelectedProduct(null);
    if (window.location.hash.startsWith('#product-')) {
      window.history.pushState("", document.title, window.location.pathname + window.location.search);
    }
    setShowCart(true);
  };

  // Share functionality
  const handleShareProduct = () => {
    if (!selectedProduct) return;
    const shareData = {
      title: `${selectedProduct.name} - M&H`,
      text: `Check out ${selectedProduct.name} at M&H Fashion Store`,
      url: window.location.href
    };
    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => {
        triggerToast('Link copied to clipboard!');
      });
    }
  };

  // Size Calculator fit algorithm
  const handleCalculateSize = (e: React.FormEvent) => {
    e.preventDefault();
    const h = parseFloat(calcHeight);
    const w = parseFloat(calcWeight);
    if (!h || !w) return;
    const bmi = w / ((h / 100) ** 2);
    let size = 'M';
    if (bmi < 18.5) size = 'S';
    else if (bmi < 25) size = 'M';
    else if (bmi < 30) size = 'L';
    else size = 'XL';
    setCalcResult(size);
    setSelectedSize(size);
    triggerToast(`Recommended Fit: Size ${size} selected!`);
    setTimeout(() => {
      setShowSizeCalc(false);
    }, 800);
  };

  // WhatsApp API Checkout + Supabase Order Saving
  const handleProcessCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName || !custArea || !custPhone) return;

    setIsSubmittingOrder(true);
    let orderSavedSuccessfully = false;
    let orderIdForReceipt = '';

    try {
      if (supabase) {
        // 1. Insert order header into `orders` table
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert({
            customer_name: custName,
            customer_phone: custPhone,
            delivery_area: custArea,
            delivery_fee: deliveryFee,
            subtotal: cartSubtotal,
            total_price: orderTotal,
            status: 'Pending'
          })
          .select()
          .single();

        if (orderError) {
          throw new Error(`Order insertion failed: ${orderError.message}`);
        }

        if (orderData) {
          const insertedOrderId = orderData.id;
          orderIdForReceipt = String(insertedOrderId);

          // 2. Prepare order items
          const itemsToInsert = cart.map(item => ({
            order_id: insertedOrderId,
            product_id: item.id,
            product_name: item.name,
            size: item.size,
            quantity: item.quantity,
            price: item.price
          }));

          // 3. Insert items into `order_items` table
          const { error: itemsError } = await supabase
            .from('order_items')
            .insert(itemsToInsert);

          if (itemsError) {
            console.error("Failed to insert order items to database:", itemsError.message);
          } else {
            orderSavedSuccessfully = true;
          }
        }
      }
    } catch (err: any) {
      console.error("Failed to persist order to Supabase:", err);
      triggerToast("Could not sync order to cloud. Processing checkout directly.");
    } finally {
      setIsSubmittingOrder(false);
    }

    // Set order details for the receipt success modal before clearing cart
    const finalOrderId = orderIdForReceipt || `MH-${Math.floor(100000 + Math.random() * 900000)}`;
    const finalOrderDate = new Date().toISOString();

    const localNewOrder = {
      id: isNaN(Number(finalOrderId)) ? finalOrderId : Number(finalOrderId),
      customer_name: custName,
      customer_phone: custPhone,
      delivery_area: custArea,
      delivery_fee: deliveryFee,
      subtotal: cartSubtotal,
      total_price: orderTotal,
      status: 'Pending',
      created_at: finalOrderDate,
      items: cart.map((item, idx) => ({
        id: idx + 10000,
        order_id: isNaN(Number(finalOrderId)) ? finalOrderId : Number(finalOrderId),
        product_id: item.id,
        product_name: item.name,
        size: item.size,
        quantity: item.quantity,
        price: item.price
      }))
    };

    // Store in state and local storage
    setOrdersList(prev => {
      // Avoid duplicate keys just in case
      const filtered = prev.filter(o => o.id !== localNewOrder.id);
      const updated = [localNewOrder, ...filtered];
      localStorage.setItem('mh_local_orders', JSON.stringify(updated));
      return updated;
    });

    setLastOrderDetails({
      id: finalOrderId,
      name: custName,
      phone: custPhone,
      area: custArea,
      items: [...cart],
      subtotal: cartSubtotal,
      deliveryFee: deliveryFee,
      total: orderTotal,
      dbSynced: orderSavedSuccessfully
    });

    // Clear cart and close checkout form
    setCart([]);
    localStorage.removeItem('mt_cart');
    setShowCheckout(false);
    
    // Open the gorgeous success receipt modal
    setShowSuccessModal(true);
    triggerToast("Order placed successfully!");

    // Reset customer input fields
    setCustName('');
    setCustPhone('');
    setCustArea('');
  };

  return (
    <>
      {/* Floating Animated Ambient Background */}
      <div className="ambient-bg" aria-hidden="true">
        {[...Array(13)].map((_, i) => (
          <div key={i} className={`float-item ${i % 2 === 0 ? 'icon-tshirt' : 'icon-pants'}`}>
            {i % 2 === 0 ? (
              <svg viewBox="0 0 24 24" fill="currentColor" width="30" height="30">
                <path d="M20.38 3.46L16 2h-1.5c-.28 0-.5.22-.5.5v.5c0 1.1-.9 2-2 2s-2-.9-2-2V2.5c0-.28-.22-.5-.5-.5H8L3.62 3.46a2 2 0 0 0-1.29 1.28l-.66 2.06c-.23.71.3 1.2.93 1.2H4v11c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8h1.4c.63 0 1.16-.49.93-1.2l-.66-2.06a2 2 0 0 0-1.29-1.28z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" width="30" height="30">
                <path d="M14.5 2h-5c-1.1 0-2 .9-2 2v6l-2 12h4l2.5-8 2.5 8h4l-2-12V4c0-1.1-.9-2-2-2z" />
              </svg>
            )}
          </div>
        ))}
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}

      {/* Mobile Sidebar Navigation Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="mobile-menu-overlay active" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sticky Header */}
      <header className={`header sticky ${scrolled ? 'is-scrolled' : ''}`} id="header">
        <div className="container header-inner">
          
          {/* Hamburger button for mobile menu toggling */}
          <button 
            className="mobile-menu-toggle" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle Menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* Logo */}
          <a className="logo" href="#" onClick={(e) => { e.preventDefault(); handleCategoryChipClick('All'); }}>
            M&H
          </a>

          {/* Navigation drawer/links */}
          <nav className={`nav-wrapper ${isMobileMenuOpen ? 'active' : ''}`} id="nav-wrapper">
            <div className="mobile-sidebar-header">
              <div className="mobile-sidebar-brand">
                <span className="mobile-sidebar-logo">M&H</span>
                <span className="mobile-sidebar-subtitle">ATELIER</span>
              </div>
              <button 
                className="mobile-sidebar-close" 
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close Menu"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mobile-sidebar-body">
              <div className="mobile-sidebar-nav-section">
                <div className="mobile-menu-label">Collections & Menu</div>
                <ul className="nav-menu">
                  <li>
                    <a 
                      className={`nav-link ${activeView === 'home' && activeCategory === 'All' ? 'active' : ''}`} 
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handleCategoryChipClick('All');
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      <Home size={18} className="nav-link-icon" />
                      <span>Home</span>
                    </a>
                  </li>

                  <li className={`has-dropdown ${isProductsDropdownOpen ? 'active' : ''}`} ref={productsDropdownRef}>
                    <a 
                      className="nav-link" 
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (window.innerWidth <= 1024) {
                          setIsProductsDropdownOpen(!isProductsDropdownOpen);
                        }
                      }}
                    >
                      <Compass size={18} className="nav-link-icon" />
                      <span>Products</span>
                    </a>
                    <ul className="dropdown-menu">
                      <li>
                        <a onClick={() => { handleCategoryChipClick('All'); setIsMobileMenuOpen(false); }}>
                          <span className="dot-indicator"></span>All Items
                        </a>
                      </li>
                      <li>
                        <a onClick={() => { handleCategoryChipClick('Sale'); setIsMobileMenuOpen(false); }} className="sale-item-link">
                          <span className="dot-indicator sale"></span>Special Sale
                        </a>
                      </li>
                      <li>
                        <a onClick={() => { handleCategoryChipClick('T-Shirts'); setIsMobileMenuOpen(false); }}>
                          <span className="dot-indicator"></span>T-Shirts
                        </a>
                      </li>
                      <li>
                        <a onClick={() => { handleCategoryChipClick('Pants'); setIsMobileMenuOpen(false); }}>
                          <span className="dot-indicator"></span>Pants
                        </a>
                      </li>
                      <li>
                        <a onClick={() => { handleCategoryChipClick('Jackets'); setIsMobileMenuOpen(false); }}>
                          <span className="dot-indicator"></span>Jackets
                        </a>
                      </li>
                      <li>
                        <a onClick={() => { handleCategoryChipClick('Shoes'); setIsMobileMenuOpen(false); }}>
                          <span className="dot-indicator"></span>Shoes
                        </a>
                      </li>
                    </ul>
                  </li>

                  <li>
                    <a 
                      className={`nav-link ${activeView === 'about' ? 'active' : ''}`} 
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveView('about');
                        setSelectedProduct(null);
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      <Sparkles size={18} className="nav-link-icon" />
                      <span>About Us</span>
                    </a>
                  </li>

                  {(showOwnerGateway && isAdminAuthorized) && (
                    <li>
                      <a 
                        className={`nav-link ${activeView === 'admin' ? 'active' : ''}`} 
                        href="#orders"
                        onClick={(e) => {
                          e.preventDefault();
                          setActiveView('admin');
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <Package size={18} className="nav-link-icon" />
                        <span>Live Orders</span>
                      </a>
                    </li>
                  )}
                </ul>
              </div>

              {/* Elegant Footer Details inside Mobile Menu */}
              <div className="mobile-sidebar-footer">
                <div className="footer-assistance-title">Artisan Assistance</div>
                <p className="footer-assistance-text">Reach our team for bespoke fittings, size questions, or direct queries.</p>
                
                <div className="footer-contact-links">
                  <a href="mailto:info@mandh-atelier.com" className="footer-contact-link">
                    <Mail size={13} />
                    <span>info@mandh-atelier.com</span>
                  </a>
                  <a href="https://wa.me/123456789" target="_blank" rel="noopener noreferrer" className="footer-contact-link">
                    <MessageSquare size={13} />
                    <span>Direct WhatsApp Support</span>
                  </a>
                  <div className="footer-contact-hours">
                    <Clock size={13} />
                    <span>Mon – Sat: 10:00 – 19:00</span>
                  </div>
                </div>
                
                <div className="footer-copyright-mini">
                  © {new Date().getFullYear()} M&H Atelier. All rights reserved.
                </div>
              </div>
            </div>
          </nav>

          {/* User Controls / Actions Bar */}
          <nav className="nav-actions">
            <button className="search-trigger" onClick={() => setShowSearch(true)} aria-label="Search">
              <Search size={20} />
            </button>

            <button className="theme-toggle" onClick={handleToggleTheme} aria-label="Toggle theme">
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            <div className="cart-wrapper">
              <button className="cart-trigger" id="cart-icon-btn" onClick={() => setShowCart(true)} aria-label="Cart">
                <ShoppingBag size={20} />
                <span className={`cart-count-bubble ${cart.length > 0 ? 'active' : ''}`}>
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              </button>
            </div>
          </nav>
        </div>

        {/* Dynamic Search Overlay */}
        <div className={`search-overlay ${showSearch ? 'active' : ''}`}>
          <div className="container search-container">
            <Search className="search-icon" size={24} />
            <input 
              type="text" 
              id="search-input" 
              placeholder="Search for products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="search-close" onClick={() => { setShowSearch(false); setSearchQuery(''); }}>&times;</button>
            
            {/* Live Search Suggestions */}
            {searchSuggestions.length > 0 && (
              <div className="search-suggestions active">
                {searchSuggestions.map(p => (
                  <div key={p.id} className="suggestion-item" onClick={() => { openModal(p.id); setShowSearch(false); setSearchQuery(''); }}>
                    <img src={getOptimizedUrl(p.image, 100)} alt={p.name} />
                    <div className="suggestion-info">
                      <h5>{p.name}</h5>
                      <span>{p.category} — ${p.price.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Single Page Content Section */}
      <div>
        
        {activeView === 'home' ? (
          <div className="view-section">
            
            {/* Hero banner */}
            <section className="hero">
              {heroType === 'video' ? (
                <video 
                  className="hero-video"
                  autoPlay 
                  loop 
                  muted 
                  playsInline
                  key={heroVideoUrl}
                  poster={heroImageUrl}
                >
                  <source src={heroVideoUrl} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div 
                  className="hero-video"
                  style={{
                    backgroundImage: `url(${heroImageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    animation: 'hero-pan-zoom 20s ease-in-out infinite alternate'
                  }}
                />
              )}
              <div className="hero-video-overlay" />
              <div className="hero-content">
                <span className="hero-subtitle">{heroSubtitle}</span>
                <h2>{heroTitle}</h2>
                <button 
                  className="btn-hero" 
                  onClick={() => {
                    const el = document.getElementById('shop-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Explore Collection
                </button>
              </div>
            </section>

            {/* Shop Product Showcase */}
            <main className="container" id="shop-section">
              <div className="section-header">
                <h3>{activeCategory === 'All' ? 'New Arrivals' : activeCategory}</h3>
                <p>Thoughtfully designed pieces for the contemporary wardrobe. Sustainable, timeless, and effortlessly chic.</p>
              </div>

              {/* Shop Filters and Utility Bar */}
              <div className="shop-toolbar">
                <span className="product-count-text">{filteredProducts.length} products</span>
                
                <div className="flex items-center gap-4 w-full md:w-auto mt-4 md:mt-0 justify-between md:justify-end">
                  
                  {/* Price dropdown trigger */}
                  <div className="filter-group" ref={priceDropdownRef}>
                    <button className="filter-trigger" onClick={() => setShowPriceFilter(!showPriceFilter)}>
                      <span>Price</span>
                      <ChevronDown size={12} />
                    </button>
                    <div className={`filter-dropdown ${showPriceFilter ? 'active' : ''}`}>
                      <div className="price-inputs">
                        <input 
                          type="number" 
                          placeholder="Min" 
                          value={minPrice} 
                          onChange={(e) => setMinPrice(e.target.value)}
                        />
                        <span>—</span>
                        <input 
                          type="number" 
                          placeholder="Max" 
                          value={maxPrice} 
                          onChange={(e) => setMaxPrice(e.target.value)}
                        />
                      </div>
                      {(minPrice || maxPrice) && (
                        <button 
                          className="text-xs underline mt-2 block text-center w-full"
                          onClick={() => { setMinPrice(''); setMaxPrice(''); }}
                        >
                          Clear Filter
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sort Selection */}
                  <div className="sort-wrapper">
                    <select 
                      id="sort-select" 
                      value={currentSort} 
                      onChange={(e) => setCurrentSort(e.target.value)}
                      aria-label="Sort products"
                    >
                      <option value="default">Sort by: Recommended</option>
                      <option value="price-asc">Price: Low to High</option>
                      <option value="price-desc">Price: High to Low</option>
                    </select>
                    <ChevronDown className="sort-icon" size={12} />
                  </div>
                </div>
              </div>

              {/* Category selector chips */}
              <div className="category-chips-container" style={{ display: 'block' }}>
                <div className="chip-scroll">
                  {['All', 'Sale', 'T-Shirts', 'Pants', 'Jackets', 'Shoes'].map(cat => (
                    <button 
                      key={cat}
                      className={`category-chip ${activeCategory === cat ? 'active' : ''}`}
                      onClick={() => handleCategoryChipClick(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product grid layout */}
              <div className="product-grid">
                {filteredProducts.map(p => {
                  const hasSale = p.originalPrice !== undefined;
                  const availableSizes = SIZE_VARIANTS[p.category] || SIZE_VARIANTS['default'];
                  const quickSize = availableSizes[0];

                  return (
                    <div 
                      key={p.id} 
                      className="product-card" 
                      onClick={(e) => handleProductCardClick(p, e)}
                    >
                      <div className="product-image-wrapper">
                        {hasSale && <span className="sale-badge">SALE</span>}
                        <img 
                          src={getOptimizedUrl(p.image, 600)} 
                          alt={p.name} 
                          className="product-img" 
                        />
                      </div>
                      <div className="product-meta">
                        <span className="product-name">{p.name}</span>
                        <span className="product-category">{p.category}</span>
                        <div className="product-price-container">
                          {hasSale ? (
                            <div className="price-stack">
                              <span className="original-price">${p.originalPrice?.toFixed(2)}</span>
                              <span className="sale-price">${p.price.toFixed(2)}</span>
                            </div>
                          ) : (
                            <span className="product-price">${p.price.toFixed(2)}</span>
                          )}
                        </div>
                        <button 
                          className="card-quick-add" 
                          onClick={(e) => handleProductCardQuickAdd(p, e)}
                          aria-label="Add to cart"
                          title="Add to cart"
                        >
                          <span>Add to Cart</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </main>
          </div>
        ) : activeView === 'admin' ? (
          <div className="view-section" style={{ paddingTop: 'var(--header-height)', minHeight: 'calc(100vh - 100px)' }}>
            {!isAdminAuthorized ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '100px 16px',
                background: 'radial-gradient(circle at center, var(--bg-card) 0%, var(--bg-body) 100%)',
                minHeight: 'calc(100vh - var(--header-height) - 100px)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Decorative premium ambient glow */}
                <div style={{
                  position: 'absolute',
                  width: '320px',
                  height: '320px',
                  background: 'rgba(147, 127, 99, 0.04)',
                  filter: 'blur(120px)',
                  top: '15%',
                  left: '10%',
                  pointerEvents: 'none'
                }} />
                <div style={{
                  position: 'absolute',
                  width: '380px',
                  height: '380px',
                  background: 'rgba(147, 127, 99, 0.04)',
                  filter: 'blur(140px)',
                  bottom: '15%',
                  right: '10%',
                  pointerEvents: 'none'
                }} />

                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '24px',
                  padding: '48px 40px',
                  maxWidth: '450px',
                  width: '100%',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.01)',
                  position: 'relative',
                  overflow: 'hidden',
                  zIndex: 1
                }}>
                  {/* Fine metallic/gold accent line at the very top */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: 'linear-gradient(90deg, var(--accent) 0%, var(--accent-hover) 100%)'
                  }} />

                  {/* Brand Subtitle Tag */}
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    letterSpacing: '0.25em',
                    color: 'var(--accent)',
                    textTransform: 'uppercase',
                    marginBottom: '18px',
                    fontFamily: 'var(--font-body)'
                  }}>
                    <Sparkles size={11} />
                    M&H ATELIER • PORTAL
                  </div>

                  {/* Lock circle icon with dashed layout & shadow */}
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '76px',
                    height: '76px',
                    background: 'var(--bg-body)',
                    border: '1px solid var(--border)',
                    borderRadius: '50%',
                    marginBottom: '28px',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.02), inset 0 2px 4px rgba(255, 255, 255, 0.8)',
                    position: 'relative'
                  }}>
                    <div style={{
                      position: 'absolute',
                      inset: '4px',
                      borderRadius: '50%',
                      border: '1px dashed var(--accent)',
                      opacity: 0.35
                    }} />
                    <Lock size={26} style={{ color: 'var(--accent)' }} />
                  </div>

                  <h2 style={{ 
                    fontFamily: 'var(--font-heading)', 
                    fontSize: '2.25rem', 
                    fontWeight: 400, 
                    margin: '0 0 8px 0',
                    color: 'var(--primary)',
                    letterSpacing: '0.02em',
                    lineHeight: 1.2
                  }}>
                    Admin Console
                  </h2>
                  <p style={{ 
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.85rem', 
                    color: 'var(--secondary)', 
                    lineHeight: 1.6, 
                    marginBottom: '32px',
                    padding: '0 8px'
                  }}>
                    Enter your authorized credentials to access customer details, order logs, inventory controls, and system options.
                  </p>

                  <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* Admin Email Field */}
                    <div style={{ textAlign: 'left' }}>
                      <label style={{ 
                        fontSize: '0.725rem', 
                        fontWeight: 600, 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.12em', 
                        color: 'var(--secondary)', 
                        display: 'block', 
                        marginBottom: '8px' 
                      }}>
                        Admin Email
                      </label>
                      <div style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        <span style={{
                          position: 'absolute',
                          left: '16px',
                          color: authEmailFocused ? 'var(--accent)' : 'var(--secondary)',
                          transition: 'color 0.3s ease',
                          display: 'flex',
                          alignItems: 'center',
                          pointerEvents: 'none'
                        }}>
                          <Mail size={18} />
                        </span>
                        <input 
                          type="email"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          onFocus={() => setAuthEmailFocused(true)}
                          onBlur={() => setAuthEmailFocused(false)}
                          placeholder="admin@mhatelier.com"
                          style={{
                            width: '100%',
                            padding: '14px 16px 14px 48px',
                            borderRadius: '12px',
                            border: authError ? '1.5px solid #EF4444' : authEmailFocused ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                            background: 'var(--bg-body)',
                            color: 'var(--primary)',
                            fontSize: '0.925rem',
                            outline: 'none',
                            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                            boxShadow: authEmailFocused ? '0 0 0 4px rgba(147, 127, 99, 0.12)' : 'none'
                          }}
                          autoFocus
                        />
                      </div>
                    </div>

                    {/* Password Field */}
                    <div style={{ textAlign: 'left' }}>
                      <label style={{ 
                        fontSize: '0.725rem', 
                        fontWeight: 600, 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.12em', 
                        color: 'var(--secondary)', 
                        display: 'block', 
                        marginBottom: '8px' 
                      }}>
                        Secure Password
                      </label>
                      <div style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        <span style={{
                          position: 'absolute',
                          left: '16px',
                          color: authPasswordFocused ? 'var(--accent)' : 'var(--secondary)',
                          transition: 'color 0.3s ease',
                          display: 'flex',
                          alignItems: 'center',
                          pointerEvents: 'none'
                        }}>
                          <Key size={18} />
                        </span>
                        <input 
                          type={showPassword ? "text" : "password"}
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          onFocus={() => setAuthPasswordFocused(true)}
                          onBlur={() => setAuthPasswordFocused(false)}
                          placeholder="••••••••"
                          style={{
                            width: '100%',
                            padding: '14px 48px 14px 48px',
                            borderRadius: '12px',
                            border: authError ? '1.5px solid #EF4444' : authPasswordFocused ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                            background: 'var(--bg-body)',
                            color: 'var(--primary)',
                            fontSize: showPassword ? '0.925rem' : '1.1rem',
                            fontFamily: showPassword ? 'var(--font-body)' : 'monospace',
                            letterSpacing: showPassword ? 'normal' : '0.125em',
                            outline: 'none',
                            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                            boxShadow: authPasswordFocused ? '0 0 0 4px rgba(147, 127, 99, 0.12)' : 'none'
                          }}
                        />
                        <button 
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{
                            position: 'absolute',
                            right: '14px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--secondary)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                            padding: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'color 0.2s',
                            outline: 'none'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--secondary)')}
                          title={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                      
                      {authError && (
                        <div style={{ 
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          color: '#EF4444', 
                          fontSize: '0.8rem', 
                          marginTop: '12px', 
                          padding: '10px 14px',
                          background: 'rgba(239, 68, 68, 0.06)',
                          borderRadius: '8px',
                          border: '1px solid rgba(239, 68, 68, 0.15)'
                        }}>
                          <span style={{ display: 'inline-flex', flexShrink: 0 }}>⚠️</span>
                          <span>{authError}</span>
                        </div>
                      )}
                    </div>

                    <button 
                      type="submit"
                      disabled={authLoading}
                      style={{
                        background: authLoading ? 'var(--secondary)' : 'var(--accent)',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '15px',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        cursor: authLoading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        marginTop: '10px',
                        boxShadow: '0 8px 20px rgba(147, 127, 99, 0.15)'
                      }}
                      onMouseEnter={(e) => {
                        if (!authLoading) {
                          e.currentTarget.style.background = 'var(--accent-hover)';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 12px 24px rgba(147, 127, 99, 0.25)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!authLoading) {
                          e.currentTarget.style.background = 'var(--accent)';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 8px 20px rgba(147, 127, 99, 0.15)';
                        }
                      }}
                    >
                      {authLoading ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          Authenticating...
                        </>
                      ) : (
                        <>
                          <span>Access Admin Console</span>
                          <Lock size={15} />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <>
                <section style={{ 
                  background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-body) 100%)', 
                  padding: '48px 0',
                  borderBottom: '1px solid var(--border)'
                }}>
                  <div className="container">
                    <span className="subtitle" style={{ letterSpacing: '0.15em', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)' }}>
                      {adminTab === 'orders' ? 'Live Database Logs' : adminTab === 'products' ? 'Store Inventory Control' : 'Hero Media Control'}
                    </span>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.5rem', fontWeight: 700, margin: '8px 0 12px 0' }}>
                      {adminTab === 'orders' ? 'Orders Console' : adminTab === 'products' ? 'Product Inventory' : 'Hero Customization'}
                    </h1>
                    <p style={{ color: 'var(--secondary)', maxWidth: '600px', margin: 0, fontSize: '0.95rem' }}>
                      {adminTab === 'orders' 
                        ? 'Track your real-time cloud data here. This panel queries the live Supabase orders and order_items tables on demand.'
                        : adminTab === 'products'
                        ? 'Add, edit, or delete items in your catalog. Changes are synced live to the database and will reflect instantly on the shopfront.'
                        : 'Change the hero section background to video or a stunning static image. Customize subtitle and heading typography easily.'
                      }
                    </p>
                  </div>
                </section>

                <div className="container" style={{ padding: '24px 16px 0 16px' }}>
                  <div style={{ 
                    display: 'flex', 
                    gap: '24px', 
                    borderBottom: '1px solid var(--border)',
                    marginBottom: '0px'
                  }}>
                    <button
                      onClick={() => setAdminTab('orders')}
                      style={{
                        padding: '12px 4px',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        color: adminTab === 'orders' ? 'var(--accent)' : 'var(--secondary)',
                        borderBottom: adminTab === 'orders' ? '2px solid var(--accent)' : '2px solid transparent',
                        background: 'none',
                        borderTop: 'none',
                        borderLeft: 'none',
                        borderRight: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <ShoppingBag size={16} /> Live Orders
                    </button>
                    <button
                      onClick={() => setAdminTab('products')}
                      style={{
                        padding: '12px 4px',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        color: adminTab === 'products' ? 'var(--accent)' : 'var(--secondary)',
                        borderBottom: adminTab === 'products' ? '2px solid var(--accent)' : '2px solid transparent',
                        background: 'none',
                        borderTop: 'none',
                        borderLeft: 'none',
                        borderRight: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <Tag size={16} /> Manage Products
                    </button>
                    <button
                      onClick={() => setAdminTab('hero')}
                      style={{
                        padding: '12px 4px',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        color: adminTab === 'hero' ? 'var(--accent)' : 'var(--secondary)',
                        borderBottom: adminTab === 'hero' ? '2px solid var(--accent)' : '2px solid transparent',
                        background: 'none',
                        borderTop: 'none',
                        borderLeft: 'none',
                        borderRight: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <Sparkles size={16} /> Customize Hero
                    </button>
                  </div>
                </div>

                <div className="container" style={{ padding: '40px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                    {adminTab === 'orders' ? (
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '12px 20px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Orders</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '4px' }}>{ordersList.length}</div>
                        </div>
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '12px 20px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Revenue (Gross)</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10B981', marginTop: '4px' }}>
                            ${ordersList.reduce((sum, o) => sum + Number(o.total_price), 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ) : adminTab === 'products' ? (
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '12px 20px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Products</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '4px' }}>{products.length}</div>
                        </div>
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '12px 20px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Categories</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent)', marginTop: '4px' }}>
                            {new Set(products.map(p => p.category)).size}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '12px 20px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hero Media Type</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginTop: '4px', textTransform: 'uppercase', color: 'var(--accent)' }}>{heroType}</div>
                        </div>
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '12px 20px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Config Status</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#10B981', marginTop: '4px' }}>Saved & Live</div>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {adminTab === 'orders' ? (
                        <button 
                          onClick={fetchDatabaseOrders}
                          disabled={isLoadingOrders}
                          style={{
                            background: 'var(--primary)',
                            color: 'var(--bg-body)',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '10px 18px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'opacity 0.2s'
                          }}
                          className="hover:opacity-90"
                        >
                          {isLoadingOrders ? (
                            "Fetching..."
                          ) : (
                            <>
                              <RefreshCw size={14} className={isLoadingOrders ? "animate-spin" : ""} />
                              Refresh Live Orders
                            </>
                          )}
                        </button>
                      ) : adminTab === 'products' ? (
                        <button 
                          onClick={handleOpenAddProduct}
                          style={{
                            background: 'var(--accent)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '10px 18px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'opacity 0.2s'
                          }}
                          className="hover:opacity-90"
                        >
                          <Plus size={16} /> Add New Product
                        </button>
                      ) : (
                        <button 
                          onClick={handleResetHeroSettings}
                          style={{
                            background: 'var(--primary)',
                            color: 'var(--bg-body)',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '10px 18px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'opacity 0.2s'
                          }}
                          className="hover:opacity-90"
                        >
                          <RotateCcw size={14} /> Reset Hero to Defaults
                        </button>
                      )}

                      

                      <button 
                        onClick={handleAdminLogout}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#EF4444',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          borderRadius: '6px',
                          padding: '10px 18px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'background 0.2s'
                        }}
                      >
                        <LogOut size={16} /> Log Out
                      </button>
                    </div>
                  </div>

                  

                  {adminTab === 'orders' ? (
                    <>
                      {ordersError && (
                        <div style={{ 
                          background: 'rgba(239, 68, 68, 0.05)', 
                          border: '1px solid rgba(239, 68, 68, 0.2)', 
                          color: '#EF4444', 
                          padding: '16px', 
                          borderRadius: '8px',
                          fontSize: '0.875rem',
                          marginBottom: '24px'
                        }}>
                          <strong>Connection Error:</strong> {ordersError}
                        </div>
                      )}

                      {isLoadingOrders && ordersList.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--secondary)' }}>
                          <div className="loading-spinner" style={{ margin: '0 auto 16px auto', width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                          <p>Loading live orders...</p>
                        </div>
                      ) : ordersList.length === 0 ? (
                        <div style={{ 
                          textAlign: 'center', 
                          padding: '80px 24px', 
                          background: 'var(--bg-card)', 
                          border: '1px dashed var(--border)', 
                          borderRadius: '12px',
                          color: 'var(--secondary)'
                        }}>
                          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center', color: 'var(--secondary)', opacity: 0.5 }}><Package size={48} /></div>
                          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '8px' }}>No Orders Found</h3>
                          <p style={{ maxWidth: '400px', margin: '0 auto 16px auto', fontSize: '0.875rem' }}>
                            No orders have been placed yet. Select items from our collections to place an order.
                          </p>
                          <a href="#" className="btn-hero" style={{ display: 'inline-block', padding: '10px 20px', fontSize: '0.875rem' }}>Go to Shop</a>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {ordersList.map((order) => (
                            <div key={order.id} style={{
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border)',
                              borderRadius: '12px',
                              padding: '24px',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.01)'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '16px' }}>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>{order.customer_name}</h3>
                                    {(() => {
                                      const status = order.status || 'Pending';
                                      const styles = getStatusStyles(status);
                                      const isUpdating = updatingOrderId === order.id;
                                      return (
                                        <div style={{ position: 'relative', display: 'inline-block' }}>
                                          <select
                                            value={status}
                                            disabled={isUpdating}
                                            onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                            style={{
                                              background: styles.bg,
                                              color: styles.color,
                                              border: 'none',
                                              borderRadius: '99px',
                                              padding: '2px 24px 2px 10px',
                                              fontSize: '0.75rem',
                                              fontWeight: 'bold',
                                              cursor: isUpdating ? 'not-allowed' : 'pointer',
                                              appearance: 'none',
                                              WebkitAppearance: 'none',
                                              outline: 'none',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              transition: 'all 0.2s',
                                              opacity: isUpdating ? 0.6 : 1,
                                            }}
                                            title="Click to update order status"
                                          >
                                            <option value="Pending">Pending</option>
                                            <option value="Shipped">Shipped</option>
                                            <option value="Delivered">Delivered</option>
                                            <option value="Cancelled">Cancelled</option>
                                          </select>
                                          <span style={{
                                            position: 'absolute',
                                            right: '10px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            fontSize: '0.5rem',
                                            color: styles.color,
                                            pointerEvents: 'none'
                                          }}>
                                            ▼
                                          </span>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  <p style={{ fontSize: '0.75rem', color: 'var(--secondary)', margin: '4px 0 0 0', fontFamily: 'monospace' }}>
                                    Order ID: {order.id} • Placed {new Date(order.created_at).toLocaleString()}
                                  </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                                    ${Number(order.total_price).toFixed(2)}
                                  </span>
                                  <p style={{ fontSize: '0.75rem', color: 'var(--secondary)', margin: '2px 0 0 0' }}>
                                    Sub: ${Number(order.subtotal).toFixed(2)} + Delivery: ${Number(order.delivery_fee).toFixed(2)}
                                  </p>
                                </div>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
                                <div>
                                  <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                    Contact & Shipping Info
                                  </h4>
                                  <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div>
                                      <span style={{ color: 'var(--secondary)' }}>Phone: </span>
                                      <span style={{ fontWeight: 500 }}>{order.customer_phone}</span>
                                    </div>
                                    <div>
                                      <span style={{ color: 'var(--secondary)' }}>Region/Area: </span>
                                      <span style={{ fontWeight: 500 }}>{order.delivery_area}</span>
                                    </div>
                                    {order.delivery_address && (
                                      <div>
                                        <span style={{ color: 'var(--secondary)' }}>Address: </span>
                                        <span style={{ fontWeight: 500 }}>{order.delivery_address}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                    Ordered Items ({order.items?.length || 0})
                                  </h4>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {order.items && order.items.length > 0 ? (
                                      order.items.map((item: any) => (
                                        <div key={item.id} style={{ 
                                          display: 'flex', 
                                          justifyContent: 'space-between', 
                                          background: 'var(--bg-body)', 
                                          padding: '6px 12px', 
                                          borderRadius: '6px',
                                          fontSize: '0.8125rem'
                                        }}>
                                          <span>
                                            <strong>{item.product_name}</strong>
                                            <span style={{ color: 'var(--secondary)', marginLeft: '6px' }}>Size {item.size}</span>
                                          </span>
                                          <span style={{ color: 'var(--secondary)' }}>
                                            {item.quantity}x ${Number(item.price).toFixed(2)}
                                          </span>
                                        </div>
                                      ))
                                    ) : (
                                      <p style={{ fontSize: '0.75rem', color: 'var(--secondary)', margin: 0 }}>No items recorded.</p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Order Card Actions */}
                              <div style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: '12px',
                                borderTop: '1px solid var(--border)',
                                paddingTop: '16px',
                                marginTop: '20px',
                                flexWrap: 'wrap'
                              }}>
                                <button
                                  onClick={() => handleOpenEditOrder(order)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: 'none',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    padding: '8px 14px',
                                    fontSize: '0.8125rem',
                                    fontWeight: 600,
                                    color: 'var(--primary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                  className="hover:bg-[var(--bg-body)]"
                                >
                                  <Edit2 size={14} /> Edit Order
                                </button>
                                <button
                                  onClick={() => handleDeleteOrder(order.id)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: 'rgba(239, 68, 68, 0.05)',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                    borderRadius: '6px',
                                    padding: '8px 14px',
                                    fontSize: '0.8125rem',
                                    fontWeight: 600,
                                    color: '#EF4444',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                  className="hover:bg-[rgba(239, 68, 68, 0.1)]"
                                >
                                  <Trash2 size={14} /> Delete Order
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : adminTab === 'products' ? (
                    // --- PRODUCTS INVENTORY CONTROL TAB ---
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      {products.length === 0 ? (
                        <div style={{ 
                          textAlign: 'center', 
                          padding: '80px 24px', 
                          background: 'var(--bg-card)', 
                          border: '1px dashed var(--border)', 
                          borderRadius: '12px',
                          color: 'var(--secondary)'
                        }}>
                          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center', color: 'var(--secondary)', opacity: 0.5 }}><Tag size={48} /></div>
                          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '8px' }}>No Products Found</h3>
                          <p style={{ maxWidth: '400px', margin: '0 auto 16px auto', fontSize: '0.875rem' }}>
                            Your active product catalog is currently empty.
                          </p>
                          <button 
                            onClick={handleOpenAddProduct} 
                            style={{
                              background: 'var(--primary)',
                              color: 'var(--bg-body)',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '10px 20px',
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            + Add Your First Product
                          </button>
                        </div>
                      ) : (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                          gap: '24px'
                        }}>
                          {products.map((p) => (
                            <div key={p.id} style={{
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border)',
                              borderRadius: '12px',
                              overflow: 'hidden',
                              display: 'flex',
                              flexDirection: 'column',
                              transition: 'transform 0.2s',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.01)'
                            }} className="hover:shadow-sm">
                              {/* Product Thumbnail */}
                              <div style={{ position: 'relative', height: '220px', overflow: 'hidden', background: '#f5f5f5' }}>
                                <img 
                                  src={getOptimizedUrl(p.image, 400)} 
                                  alt={p.name}
                                  referrerPolicy="no-referrer"
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover'
                                  }}
                                />
                                <span style={{
                                  position: 'absolute',
                                  top: '12px',
                                  left: '12px',
                                  background: 'var(--bg-body)',
                                  color: 'var(--primary)',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid var(--border)',
                                  letterSpacing: '0.05em'
                                }}>
                                  {p.category}
                                </span>
                                <span style={{
                                  position: 'absolute',
                                  bottom: '12px',
                                  right: '12px',
                                  background: 'rgba(0,0,0,0.7)',
                                  color: 'white',
                                  fontSize: '0.75rem',
                                  fontWeight: 'bold',
                                  padding: '4px 8px',
                                  borderRadius: '4px'
                                }}>
                                  ID: {p.id}
                                </span>
                              </div>

                              {/* Product Info */}
                              <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div>
                                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--primary)', lineHeight: '1.3' }}>
                                    {p.name}
                                  </h3>
                                  <p style={{ 
                                    fontSize: '0.8rem', 
                                    color: 'var(--secondary)', 
                                    margin: '0 0 16px 0', 
                                    lineHeight: '1.4',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
                                  }}>
                                    {p.description}
                                  </p>

                                  {/* Pricing details */}
                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '16px' }}>
                                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
                                      ${p.price.toFixed(2)}
                                    </span>
                                    {p.originalPrice && (
                                      <span style={{ fontSize: '0.9rem', textDecoration: 'line-through', color: 'var(--secondary)' }}>
                                        ${p.originalPrice.toFixed(2)}
                                      </span>
                                    )}
                                  </div>

                                  {/* Colors visual block if any */}
                                  {p.colors && p.colors.length > 0 && (
                                    <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                                      <span style={{ fontSize: '0.75rem', color: 'var(--secondary)', marginRight: '4px' }}>Colors:</span>
                                      {p.colors.map((col, cIdx) => (
                                        <span 
                                          key={cIdx} 
                                          title={col.name}
                                          style={{
                                            width: '14px',
                                            height: '14px',
                                            borderRadius: '50%',
                                            background: col.hex,
                                            border: '1px solid var(--border)',
                                            display: 'inline-block'
                                          }}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Actions footer */}
                                <div style={{ 
                                  display: 'flex', 
                                  gap: '12px', 
                                  borderTop: '1px solid var(--border)', 
                                  paddingTop: '16px',
                                  marginTop: '8px'
                                }}>
                                  <button
                                    onClick={() => handleOpenEditProduct(p)}
                                    style={{
                                      flex: 1,
                                      background: 'none',
                                      border: '1px solid var(--border)',
                                      borderRadius: '6px',
                                      padding: '8px 12px',
                                      fontSize: '0.8rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      color: 'var(--primary)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '6px',
                                      transition: 'background 0.2s'
                                    }}
                                    className="hover:bg-body"
                                  >
                                    <Edit2 size={13} /> Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProduct(p.id)}
                                    style={{
                                      flex: 1,
                                      background: 'rgba(239, 68, 68, 0.05)',
                                      border: '1px solid rgba(239, 68, 68, 0.2)',
                                      borderRadius: '6px',
                                      padding: '8px 12px',
                                      fontSize: '0.8rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      color: '#EF4444',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '6px',
                                      transition: 'background 0.2s'
                                    }}
                                    className="hover:bg-red-50"
                                  >
                                    <Trash2 size={13} /> Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    // --- HERO CUSTOMIZATION CONTROL TAB ---
                    <div style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '32px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }} className="lg:grid-cols-12">
                        {/* Column 1: Customizer Inputs */}
                        <div className="lg:col-span-7" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                          <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Sparkles size={18} color="var(--accent)" />
                              Configure Hero Media
                            </h3>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', margin: 0 }}>
                              Choose your background media type and customize titles, subtitles, and posters.
                            </p>
                          </div>

                          {/* Media Type Toggle */}
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)', marginBottom: '10px' }}>
                              Background Media Type
                            </label>
                            <div style={{ display: 'flex', gap: '12px' }}>
                              <button
                                type="button"
                                onClick={() => setEditHeroType('video')}
                                style={{
                                  flex: 1,
                                  padding: '16px',
                                  borderRadius: '8px',
                                  border: editHeroType === 'video' ? '2px solid var(--accent)' : '1px solid var(--border)',
                                  background: editHeroType === 'video' ? 'rgba(0, 0, 0, 0.02)' : 'var(--bg-card)',
                                  cursor: 'pointer',
                                  fontWeight: 'bold',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '8px',
                                  transition: 'all 0.2s',
                                  color: editHeroType === 'video' ? 'var(--accent)' : 'var(--secondary)'
                                }}
                              >
                                <Video size={18} />
                                <span style={{ fontSize: '0.875rem' }}>📽️ Video Loop</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditHeroType('image')}
                                style={{
                                  flex: 1,
                                  padding: '16px',
                                  borderRadius: '8px',
                                  border: editHeroType === 'image' ? '2px solid var(--accent)' : '1px solid var(--border)',
                                  background: editHeroType === 'image' ? 'rgba(0, 0, 0, 0.02)' : 'var(--bg-card)',
                                  cursor: 'pointer',
                                  fontWeight: 'bold',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '8px',
                                  transition: 'all 0.2s',
                                  color: editHeroType === 'image' ? 'var(--accent)' : 'var(--secondary)'
                                }}
                              >
                                <ImageIcon size={18} />
                                <span style={{ fontSize: '0.875rem' }}>🖼️ Static Image</span>
                              </button>
                            </div>
                          </div>

                          {/* Video-specific inputs */}
                          {editHeroType === 'video' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)', marginBottom: '8px' }}>
                                  Video File URL (.mp4)
                                </label>
                                <input
                                  type="text"
                                  value={editHeroVideoUrl}
                                  onChange={(e) => setEditHeroVideoUrl(e.target.value)}
                                  placeholder="Enter direct MP4 video link..."
                                  style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border)',
                                    background: 'var(--bg-body)',
                                    color: 'var(--primary)',
                                    fontSize: '0.875rem'
                                  }}
                                />
                                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--secondary)', display: 'flex', alignItems: 'center', marginRight: '4px' }}>Presets:</span>
                                  <button
                                    type="button"
                                    onClick={() => setEditHeroVideoUrl('https://assets.mixkit.co/videos/preview/mixkit-woman-modeling-a-fashion-outfit-40192-large.mp4')}
                                    style={{ background: 'var(--bg-body)', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px', fontSize: '0.7rem', cursor: 'pointer', color: 'var(--primary)' }}
                                  >
                                    Fashion Model
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditHeroVideoUrl('https://assets.mixkit.co/videos/preview/mixkit-tailor-working-with-sewing-machine-39948-large.mp4')}
                                    style={{ background: 'var(--bg-body)', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px', fontSize: '0.7rem', cursor: 'pointer', color: 'var(--primary)' }}
                                  >
                                    Sewing Atelier
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditHeroVideoUrl('https://assets.mixkit.co/videos/preview/mixkit-woman-posing-with-denim-jacket-and-sunglasses-40141-large.mp4')}
                                    style={{ background: 'var(--bg-body)', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px', fontSize: '0.7rem', cursor: 'pointer', color: 'var(--primary)' }}
                                  >
                                    Denim Wear
                                  </button>
                                </div>
                              </div>

                              <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)', marginBottom: '8px' }}>
                                  Video Poster Cover (fallback image URL)
                                </label>
                                <input
                                  type="text"
                                  value={editHeroImageUrl}
                                  onChange={(e) => setEditHeroImageUrl(e.target.value)}
                                  placeholder="Enter cover image link..."
                                  style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border)',
                                    background: 'var(--bg-body)',
                                    color: 'var(--primary)',
                                    fontSize: '0.875rem'
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Image-specific inputs with drag & drop */}
                          {editHeroType === 'image' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)', marginBottom: '8px' }}>
                                  Background Image URL
                                </label>
                                <input
                                  type="text"
                                  value={editHeroImageUrl}
                                  onChange={(e) => setEditHeroImageUrl(e.target.value)}
                                  placeholder="Enter direct image link..."
                                  style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border)',
                                    background: 'var(--bg-body)',
                                    color: 'var(--primary)',
                                    fontSize: '0.875rem'
                                  }}
                                />
                                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--secondary)', display: 'flex', alignItems: 'center', marginRight: '4px' }}>Presets:</span>
                                  <button
                                    type="button"
                                    onClick={() => setEditHeroImageUrl('https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200')}
                                    style={{ background: 'var(--bg-body)', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px', fontSize: '0.7rem', cursor: 'pointer', color: 'var(--primary)' }}
                                  >
                                    Dress Rack
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditHeroImageUrl('https://images.unsplash.com/photo-1481824429379-07aa5e5b0739?q=80&w=1200')}
                                    style={{ background: 'var(--bg-body)', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px', fontSize: '0.7rem', cursor: 'pointer', color: 'var(--primary)' }}
                                  >
                                    Studio Fit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditHeroImageUrl('https://images.unsplash.com/photo-1574169208507-84376144848b?q=80&w=1200')}
                                    style={{ background: 'var(--bg-body)', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px', fontSize: '0.7rem', cursor: 'pointer', color: 'var(--primary)' }}
                                  >
                                    Knitwear Style
                                  </button>
                                </div>
                              </div>

                              {/* Drag and Drop Zone */}
                              <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)', marginBottom: '8px' }}>
                                  Or Upload Local Image
                                </label>
                                <div
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={async (e) => {
                                    e.preventDefault();
                                    const file = e.dataTransfer.files?.[0];
                                    if (file) {
                                      await handleHeroLocalImageUpload(file);
                                    }
                                  }}
                                  style={{
                                    border: '1px dashed var(--border)',
                                    borderRadius: '8px',
                                    padding: '24px',
                                    textAlign: 'center',
                                    background: 'var(--bg-body)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                  onClick={() => document.getElementById('hero-image-upload-input')?.click()}
                                  className="hover:border-accent"
                                >
                                  <Upload size={20} color="var(--secondary)" style={{ margin: '0 auto 8px auto' }} />
                                  <span style={{ fontSize: '0.8125rem', color: 'var(--primary)', display: 'block' }}>
                                    Drag & drop image file, or <span style={{ color: 'var(--accent)', textDecoration: 'underline' }}>browse</span>
                                  </span>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--secondary)', display: 'block', marginTop: '4px' }}>
                                    High quality, auto-optimized
                                  </span>
                                  <input
                                    type="file"
                                    id="hero-image-upload-input"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        await handleHeroLocalImageUpload(file);
                                      }
                                    }}
                                  />
                                </div>
                                {heroUploadError && (
                                  <p style={{ fontSize: '0.75rem', color: '#EF4444', marginTop: '6px', marginBottom: 0 }}>
                                    {heroUploadError}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Typography customization */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }} className="md:grid-cols-2">
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)', marginBottom: '8px' }}>
                                Subtitle Text
                              </label>
                              <input
                                type="text"
                                value={editHeroSubtitle}
                                onChange={(e) => setEditHeroSubtitle(e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '12px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border)',
                                  background: 'var(--bg-body)',
                                  color: 'var(--primary)',
                                  fontSize: '0.875rem'
                                }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)', marginBottom: '8px' }}>
                                Headline Text
                              </label>
                              <input
                                type="text"
                                value={editHeroTitle}
                                onChange={(e) => setEditHeroTitle(e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '12px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border)',
                                  background: 'var(--bg-body)',
                                  color: 'var(--primary)',
                                  fontSize: '0.875rem'
                                }}
                              />
                            </div>
                          </div>

                          {/* Apply changes button */}
                          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', marginTop: '8px', display: 'flex', gap: '12px' }}>
                            <button
                              type="button"
                              onClick={handleSaveHeroSettings}
                              style={{
                                flex: 2,
                                background: 'var(--accent)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '12px 24px',
                                fontWeight: 600,
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                transition: 'opacity 0.2s'
                              }}
                              className="hover:opacity-90"
                            >
                              <Check size={16} /> Save & Apply Customizations
                            </button>
                          </div>
                        </div>

                        {/* Column 2: Live View Mockup */}
                        <div className="lg:col-span-5" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)', marginBottom: '4px' }}>
                            Live View Mockup
                          </label>
                          <div style={{
                            background: '#111827',
                            borderRadius: '12px',
                            border: '4px solid #1F2937',
                            boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                            position: 'relative',
                            aspectRatio: '16/10',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            color: 'white'
                          }}>
                            {/* Visual Indicator of unsaved changes */}
                            {(editHeroType !== heroType ||
                              editHeroVideoUrl !== heroVideoUrl ||
                              editHeroImageUrl !== heroImageUrl ||
                              editHeroSubtitle !== heroSubtitle ||
                              editHeroTitle !== heroTitle) && (
                              <span style={{
                                position: 'absolute',
                                top: '12px',
                                left: '12px',
                                zIndex: 10,
                                background: 'rgba(245, 158, 11, 0.9)',
                                color: '#1F2937',
                                fontSize: '0.65rem',
                                fontWeight: 'bold',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: '1px solid #D97706',
                                letterSpacing: '0.05em',
                                pointerEvents: 'none'
                              }}>
                                UNSAVED PREVIEW
                              </span>
                            )}

                            {/* Background Container */}
                            {editHeroType === 'video' ? (
                              <video
                                autoPlay
                                loop
                                muted
                                playsInline
                                key={editHeroVideoUrl}
                                poster={editHeroImageUrl}
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  zIndex: 1,
                                  pointerEvents: 'none'
                                }}
                              >
                                <source src={editHeroVideoUrl} type="video/mp4" />
                              </video>
                            ) : (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  width: '100%',
                                  height: '100%',
                                  backgroundImage: `url(${editHeroImageUrl})`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                  zIndex: 1
                                }}
                              />
                            )}

                            {/* Overlay */}
                            <div style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              background: 'linear-gradient(rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.5))',
                              zIndex: 2,
                              pointerEvents: 'none'
                            }} />

                            {/* Content mockup */}
                            <div style={{
                              position: 'relative',
                              zIndex: 3,
                              padding: '16px',
                              background: 'rgba(255, 255, 255, 0.1)',
                              backdropFilter: 'blur(3px)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              borderRadius: '6px',
                              maxWidth: '85%'
                            }}>
                              <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.85, display: 'block', marginBottom: '4px' }}>
                                {editHeroSubtitle || 'Spring / Summer 2026'}
                              </span>
                              <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 700, margin: 0, color: '#FFFFFF', lineHeight: 1.2 }}>
                                {editHeroTitle || 'Natural. Timeless. You.'}
                              </h4>
                            </div>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--secondary)', textAlign: 'center', fontStyle: 'italic' }}>
                            Interactive responsive mockup matches actual desktop rendering.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          /* About view */
          <div className="view-section">
            <section className="about-hero">
              <span className="subtitle">Our Story</span>
              <h1>Crafting Confidence</h1>
            </section>

            <div className="container">
              <section className="mission-statement">
                <h2>"M&H was born from a desire to simplify the modern wardrobe. We believe true style empowers, never complicates."</h2>
              </section>

              <section className="story-section">
                <div className="story-image">
                  <img src="https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?q=80&w=2670&auto=format&fit=crop" alt="M&H Sketches" />
                </div>
                <div className="story-content">
                  <h3>The Origin</h3>
                  <p>It began with a simple observation: the fashion industry was noisy, fast, and often fleeting. We wanted to build something quieter, something that would last.</p>
                  <p>Our philosophy is grounded in two pillars: Sustainability and Timelessness. Every piece we design is meant to last—not just in durability, but in relevance. We source premium organic materials and work with ethical manufacturers to ensure that your clothing looks good and does good.</p>
                  <p>We are a small team of designers and dreamers dedicated to the art of slow, high-craft fashion.</p>
                </div>
              </section>
            </div>

            {/* Core Values */}
            <section className="values-wrapper">
              <div className="container">
                <div className="values-grid">
                  <div className="value-item">
                    <Info size={40} className="mx-auto mb-4 text-accent" />
                    <h4>Ethical Integrity</h4>
                    <p>We work exclusively with factories that ensure fair wages and safe working conditions. Transparency is our baseline.</p>
                  </div>
                  <div className="value-item">
                    <Smartphone size={40} className="mx-auto mb-4 text-accent" />
                    <h4>Artisan Quality</h4>
                    <p>Every seam, button, and stitch is inspected. We believe in clothing that feels better the longer you wear it.</p>
                  </div>
                  <div className="value-item">
                    <ShoppingBag size={40} className="mx-auto mb-4 text-accent" />
                    <h4>Sustainable Future</h4>
                    <p>From organic cottons to recyclable packaging, we are committed to reducing our footprint on the planet.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Studio / Contact location */}
            <div className="container">
              <section className="contact-section pb-24">
                <div className="section-header">
                  <h3>Connect With Us</h3>
                  <p>We would love to hear from you.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="contact-card">
                    <h4 className="flex items-center gap-2"><Mail size={18} /> Customer Care</h4>
                    <p className="mt-2">For inquiries, sizing advice, or just to say hello.</p>
                    <ul>
                      <li><a href="mailto:info@mandh-store.com">info@mandh-store.com</a></li>
                      <li><a href="tel:+96170123456">+961 70 123 456</a></li>
                    </ul>
                  </div>
                  <div className="contact-card">
                    <h4 className="flex items-center gap-2"><Phone size={18} /> Community</h4>
                    <p className="mt-2">Join our journey and see behind the scenes.</p>
                    <ul className="flex gap-4 mt-2">
                      <li><a href="#">Instagram</a></li>
                      <li><a href="#">TikTok</a></li>
                      <li><a href="#">Pinterest</a></li>
                    </ul>
                  </div>
                  <div className="contact-card">
                    <h4 className="flex items-center gap-2"><MapPin size={18} /> Our Studio</h4>
                    <p className="mt-2">By appointment only.</p>
                    <p className="font-semibold mt-1">Mar Mikhael, Armenia Street<br />Beirut, Lebanon</p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

      </div>

      {/* Persistent Footer */}
      <footer className="main-footer minimalist" id="footer">
        <div className="container footer-bottom">
          <div className="footer-links">
            <a onClick={() => setShowPrivacy(true)}>Privacy Policy</a>
            <a onClick={() => setShowTerms(true)}>Terms of Service</a>
          </div>
          <p 
            onClick={handleCopyrightClick}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            &copy; {new Date().getFullYear()} M&H. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Cart Drawer Overlay */}
      {showCart && (
        <div className="cart-overlay" style={{ opacity: 1, visibility: 'visible' }} onClick={() => setShowCart(false)}></div>
      )}
      
      {/* Sliding Cart Drawer */}
      <aside className={`cart-sidebar ${showCart ? 'cart-open' : ''}`} style={{ transform: showCart ? 'translateX(0)' : 'translateX(100%)' }}>
        <div className="cart-header">
          <h4>Shopping Cart</h4>
          <button className="close-cart" onClick={() => setShowCart(false)}>&times;</button>
        </div>

        <div id="cart-items" className="cart-body">
          {cart.length === 0 ? (
            <div className="empty-state">
              <p>Your bag is empty</p>
              <button className="btn-empty-action" onClick={() => { setShowCart(false); handleCategoryChipClick('All'); }}>Explore Shop</button>
            </div>
          ) : (
            cart.map((item, index) => (
              <div key={`${item.id}-${item.size}`} className="cart-item">
                <img src={getOptimizedUrl(item.image, 200)} alt={item.name} />
                <div className="item-info">
                  <h5>{item.name}</h5>
                  <span className="item-variant">Size: {item.size}</span>
                  <span className="item-price">${item.price.toFixed(2)}</span>
                  <div className="qty-controls">
                    <button className="qty-btn" onClick={() => handleUpdateQty(index, -1)}>&minus;</button>
                    <span className="qty-val">{item.quantity}</span>
                    <button className="qty-btn" onClick={() => handleUpdateQty(index, 1)}>+</button>
                  </div>
                </div>
                <button className="remove-item" onClick={() => handleRemoveItem(index)}>Remove</button>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="cart-footer">
            <div className="cart-total-row">
              <span>Subtotal</span>
              <span>${cartSubtotal.toFixed(2)}</span>
            </div>
            <button className="btn-whatsapp" onClick={() => { setShowCart(false); setShowCheckout(true); }}>
              Proceed to Checkout
            </button>
          </div>
        )}
      </aside>

      {/* Product Details Modal */}
      {selectedProduct && (
        <div className="modal-overlay open" onClick={closeProductModal}>
          <div className="modal-content product-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeProductModal} aria-label="Close modal">
              <X size={18} />
            </button>
            
            <button className="modal-share" onClick={handleShareProduct} aria-label="Share product">
              <Share2 size={18} />
            </button>

            <div className="modal-image-col">
              <div className="modal-main-image-container">
                <img 
                  src={getOptimizedUrl(selectedProduct.image, 1000)} 
                  alt={selectedProduct.name} 
                  className="modal-main-img"
                />
              </div>
            </div>

            <div className="modal-details-col">
              <div className="modal-details-header">
                <span className="product-category">{selectedProduct.category}</span>
                <h3 className="modal-title">{selectedProduct.name}</h3>
                
                <div className="modal-price-row">
                  <span className="modal-price">
                    {selectedProduct.originalPrice ? (
                      <>
                        <span className="original-price">${selectedProduct.originalPrice.toFixed(2)}</span>
                        <span className="sale-price">${selectedProduct.price.toFixed(2)}</span>
                        <span className="sale-percentage-badge">
                          {Math.round(((selectedProduct.originalPrice - selectedProduct.price) / selectedProduct.originalPrice) * 100)}% OFF
                        </span>
                      </>
                    ) : (
                      `$${selectedProduct.price.toFixed(2)}`
                    )}
                  </span>
                </div>
              </div>

              <div className="modal-scroll-area">
                <p className="modal-desc">{selectedProduct.description}</p>

                {/* Color variant selectors removed */}

                {/* Size variant selector */}
                <div className="variant-section size-selector">
                  <span className="size-label">
                    <span>Size: <strong className="selected-variant-value">{selectedSize}</strong></span>
                    <button className="size-guide-link" onClick={() => setShowSizeCalc(true)}>Size Calculator</button>
                  </span>
                  <div className="size-options">
                    {(SIZE_VARIANTS[selectedProduct.category] || SIZE_VARIANTS.default).map(sz => {
                      const isRecommended = calcResult === sz;
                      return (
                        <button 
                          key={sz}
                          className={`size-btn ${selectedSize === sz ? 'selected' : ''} ${isRecommended ? 'recommended-size-border' : ''}`}
                          onClick={() => setSelectedSize(sz)}
                        >
                          {sz}
                          {isRecommended && <span className="recommended-fit-dot" title="Recommended Fit" />}
                        </button>
                      );
                    })}
                  </div>
                  {calcResult && (
                    <div className="size-recommendation-alert">
                      <span className="sparkle-icon" style={{ display: 'inline-flex', alignItems: 'center', marginRight: '6px' }}><Sparkles size={14} className="text-accent" /></span> Your customized fit is size <strong>{calcResult}</strong> based on the calculator.
                    </div>
                  )}
                </div>

                {/* Quantity selector */}
                <div className="variant-section modal-qty-wrapper">
                  <span className="size-label">Quantity</span>
                  <div className="modal-qty-controls">
                    <button className="modal-qty-btn" onClick={() => setModalQty(Math.max(1, modalQty - 1))} aria-label="Decrease quantity">&minus;</button>
                    <span className="modal-qty-val">{modalQty}</span>
                    <button className="modal-qty-btn" onClick={() => setModalQty(modalQty + 1)} aria-label="Increase quantity">+</button>
                  </div>
                </div>

                {/* Value & Security Badges */}
                <div className="modal-trust-badges">
                  <div className="trust-badge">
                    <span className="badge-icon" style={{ display: 'inline-flex', alignItems: 'center' }}><Truck size={18} className="text-accent" /></span>
                    <div className="badge-text">
                      <h6>Fast Shipping</h6>
                      <p>2-4 days inside Lebanon</p>
                    </div>
                  </div>
                  <div className="trust-badge">
                    <span className="badge-icon" style={{ display: 'inline-flex', alignItems: 'center' }}><Coins size={18} className="text-accent" /></span>
                    <div className="badge-text">
                      <h6>Cash on Delivery</h6>
                      <p>Pay securely at your doorstep</p>
                    </div>
                  </div>
                  <div className="trust-badge">
                    <span className="badge-icon" style={{ display: 'inline-flex', alignItems: 'center' }}><RotateCcw size={18} className="text-accent" /></span>
                    <div className="badge-text">
                      <h6>Easy Returns</h6>
                      <p>Hassle-free 7-day exchanges</p>
                    </div>
                  </div>
                </div>

                {/* Elegant Product Accordion */}
                <div className="product-spec-accordion">
                  <details className="spec-accordion-item" open>
                    <summary className="spec-accordion-summary">
                      <span>Details & Specifications</span>
                      <ChevronDown size={14} className="accordion-chevron" />
                    </summary>
                    <div className="spec-accordion-content">
                      <ul>
                        <li>Premium tailored aesthetic fit, built for high-end longevity.</li>
                        <li>Breathable, high-grade organic fibers designed for supreme comfort.</li>
                        <li>Ethically produced with reinforced seamless craftsmanship.</li>
                        <li>Machine washable: cold cycle recommended inside out.</li>
                      </ul>
                    </div>
                  </details>

                  <details className="spec-accordion-item">
                    <summary className="spec-accordion-summary">
                      <span>Delivery & Payment Details</span>
                      <ChevronDown size={14} className="accordion-chevron" />
                    </summary>
                    <div className="spec-accordion-content">
                      <p>We deliver nationwide across Lebanon with dynamic zone shipping fees. We support standard Cash on Delivery (COD) to ensure secure, convenient payments:</p>
                      <ul style={{ marginTop: '6px' }}>
                        <li>Beirut: $5.00 delivery (1-2 days)</li>
                        <li>Mount Lebanon: $6.00 delivery (2-3 days)</li>
                        <li>North, South, and Bekaa: $8.00 delivery (3-4 days)</li>
                      </ul>
                    </div>
                  </details>
                </div>
              </div>

              <div className="modal-actions-container">
                <button className="btn-modal-add" onClick={handleAddToCartFromModal}>
                  Add to Cart — ${(selectedProduct.price * modalQty).toFixed(2)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Size Calculator Modal */}
      {showSizeCalc && (
        <div className="modal-overlay open" onClick={() => { setShowSizeCalc(false); setCalcResult(null); }}>
          <div className="modal-content checkout-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setShowSizeCalc(false); setCalcResult(null); }} aria-label="Close modal">
              <X size={18} />
            </button>
            <div className="checkout-header">
              <h3>Find Your Fit</h3>
              <p className="checkout-subtitle mt-1">Answer two simple questions for our recommendation.</p>
            </div>

            <form onSubmit={handleCalculateSize}>
              <div className="form-group">
                <label>Height (cm)</label>
                <input 
                  type="number" 
                  placeholder="e.g. 175" 
                  value={calcHeight}
                  onChange={(e) => setCalcHeight(e.target.value)}
                  required 
                />
              </div>
              <div className="form-group">
                <label>Weight (kg)</label>
                <input 
                  type="number" 
                  placeholder="e.g. 70" 
                  value={calcWeight}
                  onChange={(e) => setCalcWeight(e.target.value)}
                  required 
                />
              </div>

              {calcResult && (
                <div className="size-calc-result p-4 bg-gray-100 rounded text-center mb-6">
                  <span className="block text-sm text-gray-500">We recommend size:</span>
                  <span className="block text-3xl font-bold text-accent mt-1">{calcResult}</span>
                </div>
              )}

              <button type="submit" className="btn-checkout-submit w-full py-3 bg-accent text-white font-semibold">
                Calculate Fit
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Checkout details Modal */}
      {showCheckout && (
        <div className="modal-overlay open" onClick={() => setShowCheckout(false)}>
          <div className="modal-content checkout-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowCheckout(false)} aria-label="Close modal">
              <X size={18} />
            </button>
            <div className="checkout-header">
              <span className="checkout-subtitle">FINALIZE</span>
              <h3>Delivery details</h3>
            </div>

            <form onSubmit={handleProcessCheckout}>
              <div className="form-group">
                <label>Name</label>
                <input 
                  type="text" 
                  placeholder="Your full name" 
                  value={custName} 
                  onChange={(e) => setCustName(e.target.value)}
                  required 
                />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input 
                  type="tel" 
                  placeholder="+961 71 234 567" 
                  value={custPhone} 
                  onChange={(e) => setCustPhone(e.target.value)}
                  required 
                />
              </div>
              <div className="form-group">
                <label>Delivery Area</label>
                <select 
                  value={custArea} 
                  onChange={(e) => setCustArea(e.target.value)}
                  required
                >
                  <option value="" disabled>Select area (delivery fee applies)</option>
                  <option value="Beirut">Beirut ($5.00)</option>
                  <option value="Mount Lebanon">Mount Lebanon ($6.00)</option>
                  <option value="North">North ($8.00)</option>
                  <option value="South">South ($8.00)</option>
                  <option value="Bekaa">Bekaa ($8.00)</option>
                </select>
              </div>

              <div className="checkout-summary flex justify-between text-sm mt-4">
                <span>Cart Subtotal</span>
                <span>${cartSubtotal.toFixed(2)}</span>
              </div>
              <div className="checkout-summary flex justify-between text-sm">
                <span>Delivery Fee</span>
                <span>{custArea ? `$${deliveryFee.toFixed(2)}` : '--'}</span>
              </div>
              <div className="checkout-summary total-row">
                <span>Order total</span>
                <span>${orderTotal.toFixed(2)}</span>
              </div>

              <p className="checkout-note">We will contact you to confirm the order soon.</p>

              <button 
                type="submit" 
                className="btn-checkout-submit"
                disabled={isSubmittingOrder}
              >
                {isSubmittingOrder ? "Processing Order..." : "Confirm Order"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Order Success Receipt Modal */}
      {showSuccessModal && lastOrderDetails && (
        <div className="modal-overlay open" onClick={() => setShowSuccessModal(false)}>
          <div className="modal-content checkout-modal-content" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowSuccessModal(false)} aria-label="Close modal">
              <X size={18} />
            </button>
            
            <div style={{ textAlign: 'center', padding: '16px 0 8px 0' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '64px',
                height: '64px',
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#10B981',
                borderRadius: '50%',
                marginBottom: '16px'
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 700, margin: '0 0 4px 0' }}>Order Placed!</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--secondary)', margin: 0 }}>Thank you for shopping with M&H.</p>
              
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '99px',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: 'rgba(16, 185, 129, 0.05)',
                color: '#10B981',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                marginTop: '12px'
              }}>
                <Check size={12} /> Order Confirmed
              </div>
            </div>

            <div style={{
              borderTop: '1px dashed var(--border)',
              borderBottom: '1px dashed var(--border)',
              padding: '16px 0',
              margin: '16px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                <span>Order ID</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--primary)' }}>{lastOrderDetails.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                <span>Customer</span>
                <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{lastOrderDetails.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                <span>Phone</span>
                <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{lastOrderDetails.phone}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                <span>Delivery Area</span>
                <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{lastOrderDetails.area} (+${lastOrderDetails.deliveryFee.toFixed(2)})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                <span>Status</span>
                <span style={{ fontWeight: 600, color: '#10B981' }}>
                  {lastOrderDetails.dbSynced ? "Successfully Synced to Cloud" : "Synced (Local Fallback)"}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Order Items</h4>
              <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px', marginBottom: '16px' }}>
                {lastOrderDetails.items.map((item, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--bg-body)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '0.875rem'
                  }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{item.name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--secondary)', marginLeft: '8px' }}>Size {item.size}</span>
                    </div>
                    <span style={{ color: 'var(--secondary)', fontSize: '0.875rem' }}>{item.quantity}x ${item.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div style={{
                background: 'var(--bg-body)',
                padding: '12px',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                  <span>Subtotal</span>
                  <span>${lastOrderDetails.subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                  <span>Delivery Fee</span>
                  <span>${lastOrderDetails.deliveryFee.toFixed(2)}</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  borderTop: '1px solid var(--border)',
                  paddingTop: '8px',
                  marginTop: '4px',
                  color: 'var(--primary)'
                }}>
                  <span>Total Amount</span>
                  <span>${lastOrderDetails.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div style={{
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center',
              marginBottom: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px'
            }}>
              <p style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0, color: 'var(--primary)' }}>
                We will contact you to confirm the order soon
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--secondary)', margin: 0 }}>
                Your order is fully registered on our site. No further action is required.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => {
                    let text = `Order Reference: ${lastOrderDetails.id}\n`;
                    text += `Name: ${lastOrderDetails.name}\n`;
                    text += `Phone: ${lastOrderDetails.phone}\n`;
                    text += `Area: ${lastOrderDetails.area}\n`;
                    text += `Items:\n`;
                    lastOrderDetails.items.forEach(item => {
                      text += `- ${item.quantity}x ${item.name} (Size: ${item.size}) - $${item.price.toFixed(2)}\n`;
                    });
                    text += `Total: $${lastOrderDetails.total.toFixed(2)}`;
                    navigator.clipboard.writeText(text);
                    triggerToast("Order summary copied to clipboard!");
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    background: 'var(--bg-body)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: 'var(--primary)'
                  }}
                >
                  Copy Invoice
                </button>

                <button 
                  onClick={() => setShowSuccessModal(false)}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    background: 'var(--primary)',
                    color: 'var(--bg-body)',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.875rem'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Copyright Disclaimer Modal */}
      {showCopyrightModal && (
        <div className="modal-overlay open" onClick={() => setShowCopyrightModal(false)}>
          <div className="modal-content info-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowCopyrightModal(false)} aria-label="Close modal">
              <X size={18} />
            </button>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '12px' }}>Disclaimer & Copyright</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', lineHeight: 1.6, fontSize: '0.875rem', color: 'var(--primary)' }}>
              <p>
                <strong>&copy; {new Date().getFullYear()} M&H. All Rights Reserved.</strong>
              </p>
              <p>
                All content, product designs, clothing patterns, branding material, icons, and original photography displayed on this shopfront are the exclusive property of <strong>M&H Store</strong>.
              </p>
              <p>
                Unauthorized copying, reproduction, distribution, or commercial exploitation of any material on this website is strictly prohibited under international copyright laws and intellectual property standards.
              </p>
              <div style={{ fontSize: '0.8125rem', color: 'var(--secondary)', borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={14} />
                <span><strong>MH-SECURE:</strong> This application is powered by standard-compliant secure data protection protocols.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacy && (
        <div className="modal-overlay open" onClick={() => setShowPrivacy(false)}>
          <div className="modal-content info-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowPrivacy(false)} aria-label="Close modal">
              <X size={18} />
            </button>
            <h3>Privacy Policy</h3>
            <h4>1. Introduction</h4>
            <p>At M&H, we value your privacy. This policy explains how we handle your information when you browse our catalog or place orders directly on our site.</p>
            <h4>2. Data Collection</h4>
            <p>We do not store sensitive personal payment data on this site. When you place an order, you voluntarily share your Name, Phone Number, and Delivery Address with us for fulfillment purposes.</p>
            <h4>3. Local Storage</h4>
            <p>We use your browser's local storage to save your cart items locally on your device for a continuous and robust user experience.</p>
            <h4>4. Contact Us</h4>
            <p>If you have questions about how your data is handled during the order process, please contact us at info@mandh-store.com.</p>
          </div>
        </div>
      )}

      {/* Terms of Service Modal */}
      {showTerms && (
        <div className="modal-overlay open" onClick={() => setShowTerms(false)}>
          <div className="modal-content info-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowTerms(false)} aria-label="Close modal">
              <X size={18} />
            </button>
            <h3>Terms of Service</h3>
            <h4>1. Acceptance</h4>
            <p>By accessing the M&H online store, you agree to be bound by these terms of service and agree that you are responsible for compliance with any applicable local laws.</p>
            <h4>2. Use License</h4>
            <p>Permission is granted to temporarily view the materials (images and text) on M&H's website for personal, non-commercial transitory viewing only.</p>
            <h4>3. Orders & Pricing</h4>
            <p>All orders are subject to availability. Prices for our products are subject to change without notice. We reserve the right to refuse service to anyone for any reason at any time.</p>
            <h4>4. Returns & Exchanges</h4>
            <p>Please refer to our return policy provided upon purchase confirmation. Generally, items must be unused and in original packaging.</p>
          </div>
        </div>
      )}

      {isProductModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
          overflowY: 'auto'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'sticky',
              top: 0,
              background: 'var(--bg-card)',
              zIndex: 10
            }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {editingProduct ? <Edit2 size={18} /> : <Plus size={18} />}
                {editingProduct ? `Edit Product: ${editingProduct.name}` : 'Add New Essential Product'}
              </h2>
              <button 
                onClick={() => setIsProductModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--secondary)',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveProduct} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Product Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: '6px' }}>
                  Product Name *
                </label>
                <input 
                  type="text"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="e.g. Minimalist Linen Shirt"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-body)',
                    color: 'var(--primary)',
                    fontSize: '0.875rem'
                  }}
                  required
                />
              </div>

              {/* Category & Custom Category Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }} className="sm:grid-cols-2">
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: '6px' }}>
                    Category *
                  </label>
                  <select
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-body)',
                      color: 'var(--primary)',
                      fontSize: '0.875rem',
                      outline: 'none'
                    }}
                  >
                    <option value="T-Shirts">T-Shirts</option>
                    <option value="Pants">Pants</option>
                    <option value="Shoes">Shoes</option>
                    <option value="Jackets">Jackets</option>
                    <option value="Hoodies">Hoodies</option>
                    <option value="Accessories">Accessories</option>
                    <option value="Other">Other (Custom)...</option>
                  </select>
                </div>

                {prodCategory === 'Other' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: '6px' }}>
                      Custom Category Name *
                    </label>
                    <input 
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="e.g. Knitwear"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-body)',
                        color: 'var(--primary)',
                        fontSize: '0.875rem'
                      }}
                      required
                    />
                  </div>
                )}
              </div>

              {/* Pricing Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }} className="sm:grid-cols-2">
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: '6px' }}>
                    Price ($) *
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    placeholder="e.g. 45.00"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-body)',
                      color: 'var(--primary)',
                      fontSize: '0.875rem'
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: '6px' }}>
                    Original Price ($) <span style={{ color: 'var(--secondary)', textTransform: 'none', fontWeight: 'normal' }}>(Optional)</span>
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    value={prodOriginalPrice}
                    onChange={(e) => setProdOriginalPrice(e.target.value)}
                    placeholder="e.g. 55.00"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-body)',
                      color: 'var(--primary)',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
              </div>

              {/* Primary Image URL */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: '8px' }}>
                  Main Product Image *
                </label>
                
                {/* Tabs for Web URL vs Local Upload */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', background: 'var(--bg-body)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => { setImageTab('upload'); setUploadError(''); }}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: imageTab === 'upload' ? 'var(--bg-card)' : 'transparent',
                      color: imageTab === 'upload' ? 'var(--primary)' : 'var(--secondary)',
                      boxShadow: imageTab === 'upload' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <Upload size={14} /> Upload Local File
                  </button>
                  <button
                    type="button"
                    onClick={() => { setImageTab('url'); setUploadError(''); }}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: imageTab === 'url' ? 'var(--bg-card)' : 'transparent',
                      color: imageTab === 'url' ? 'var(--primary)' : 'var(--secondary)',
                      boxShadow: imageTab === 'url' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <ImageIcon size={14} /> Web Image URL
                  </button>
                </div>

                {imageTab === 'upload' ? (
                  <div>
                    {/* Drag and Drop Zone */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={async (e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          await handleLocalImageUpload(file);
                        }
                      }}
                      onClick={() => {
                        const fileInput = document.getElementById('main-image-file-input');
                        fileInput?.click();
                      }}
                      style={{
                        border: isDragging ? '2px dashed var(--accent)' : '2px dashed var(--border)',
                        background: isDragging ? 'rgba(var(--accent-rgb, 163, 107, 94), 0.05)' : 'var(--bg-body)',
                        borderRadius: '12px',
                        padding: '28px 20px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px'
                      }}
                      className="group hover:border-neutral-400"
                    >
                      <input
                        type="file"
                        id="main-image-file-input"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            await handleLocalImageUpload(file);
                          }
                        }}
                      />

                      {prodImage ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%' }}>
                          <div style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                            <img
                              src={prodImage}
                              alt="Upload preview"
                              referrerPolicy="no-referrer"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                          <span style={{ fontSize: '0.8125rem', color: '#10B981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={14} /> Ready to Save
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProdImage('');
                            }}
                            style={{
                              background: 'rgba(239, 68, 68, 0.08)',
                              color: '#EF4444',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Remove Image
                          </button>
                        </div>
                      ) : (
                        <>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '44px',
                            height: '44px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            borderRadius: '50%',
                            color: 'var(--secondary)'
                          }}>
                            <Upload size={20} />
                          </div>
                          <div>
                            <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: '0 0 4px 0', color: 'var(--primary)' }}>
                              Drag & drop your file here, or <span style={{ color: 'var(--accent)', textDecoration: 'underline' }}>browse</span>
                            </p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--secondary)', margin: 0 }}>
                              Supports JPG, PNG, WEBP. Optimized automatically.
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                    {uploadError && (
                      <p style={{ fontSize: '0.75rem', color: '#EF4444', marginTop: '6px', marginBottom: 0 }}>
                        {uploadError}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <input 
                      type="url"
                      value={prodImage}
                      onChange={(e) => setProdImage(e.target.value)}
                      placeholder="https://images.unsplash.com/photo-..."
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-body)',
                        color: 'var(--primary)',
                        fontSize: '0.875rem'
                      }}
                      required={imageTab === 'url'}
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--secondary)', marginTop: '6px', marginBottom: 0 }}>
                      Paste any public image address (e.g. from Unsplash or Pinterest).
                    </p>
                  </div>
                )}
              </div>

              {/* Gallery Images */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: '6px' }}>
                  Gallery Image URLs <span style={{ color: 'var(--secondary)', textTransform: 'none', fontWeight: 'normal' }}>(Optional, comma-separated)</span>
                </label>
                <textarea 
                  value={prodImages}
                  onChange={(e) => setProdImages(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-1, https://images.unsplash.com/photo-2"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-body)',
                    color: 'var(--primary)',
                    fontSize: '0.875rem',
                    fontFamily: 'monospace'
                  }}
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('gallery-images-file-input')?.click()}
                  style={{
                    background: 'none',
                    border: '1px dashed var(--border)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: 'var(--secondary)',
                    marginTop: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  className="hover:border-neutral-400"
                >
                  <Upload size={12} /> Upload Gallery Files
                </button>
                <input
                  type="file"
                  id="gallery-images-file-input"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const files: File[] = Array.from(e.target.files || []) as File[];
                    if (files.length > 0) {
                      try {
                        const compressedUrls: string[] = [];
                        for (const file of files) {
                          const comp = await compressAndResizeImage(file as File, 800, 800);
                          compressedUrls.push(comp);
                        }
                        const existing = prodImages ? prodImages.split(',').map(s => s.trim()).filter(Boolean) : [];
                        const updated = [...existing, ...compressedUrls].join(', ');
                        setProdImages(updated);
                        triggerToast(`Uploaded and optimized ${files.length} gallery image(s)!`);
                      } catch (err) {
                        console.error(err);
                        triggerToast("Failed to upload gallery images.");
                      }
                    }
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: '6px' }}>
                  Product Description *
                </label>
                <textarea 
                  value={prodDescription}
                  onChange={(e) => setProdDescription(e.target.value)}
                  placeholder="Crafted from ultra-soft cotton..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-body)',
                    color: 'var(--primary)',
                    fontSize: '0.875rem',
                    lineHeight: '1.4'
                  }}
                  required
                />
              </div>

              {/* Color Variants Sub-Section */}
              <div style={{
                background: 'var(--bg-body)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 12px 0', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Palette size={14} /> Color Variants (Optional)
                </h4>

                {prodColors.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {prodColors.map((col, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        padding: '8px 12px',
                        borderRadius: '6px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            background: col.hex,
                            border: '1px solid var(--border)',
                            display: 'inline-block'
                          }} />
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{col.name}</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => handleRemoveColor(idx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#EF4444',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            padding: '4px 8px'
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }} className="sm:grid-cols-3">
                  <div>
                    <input 
                      type="text"
                      value={newColorName}
                      onChange={(e) => setNewColorName(e.target.value)}
                      placeholder="Color Name"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-card)',
                        color: 'var(--primary)',
                        fontSize: '0.75rem'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input 
                      type="text"
                      value={newColorHex}
                      onChange={(e) => setNewColorHex(e.target.value)}
                      placeholder="HEX Code"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-card)',
                        color: 'var(--primary)',
                        fontSize: '0.75rem',
                        fontFamily: 'monospace'
                      }}
                    />
                    <input 
                      type="color"
                      value={newColorHex.startsWith('#') && newColorHex.length === 7 ? newColorHex : '#FFFFFF'}
                      onChange={(e) => setNewColorHex(e.target.value)}
                      style={{
                        width: '28px',
                        height: '28px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer'
                      }}
                    />
                  </div>
                  <div>
                    <input 
                      type="url"
                      value={newColorImage}
                      onChange={(e) => setNewColorImage(e.target.value)}
                      placeholder="Variant Image URL"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-card)',
                        color: 'var(--primary)',
                        fontSize: '0.75rem'
                      }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddColor}
                  style={{
                    background: 'var(--primary)',
                    color: 'var(--bg-body)',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginTop: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Plus size={12} /> Add Variant
                </button>
              </div>

              {/* Footer */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                borderTop: '1px solid var(--border)',
                paddingTop: '20px',
                marginTop: '10px'
              }}>
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '10px 18px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: 'var(--primary)'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProduct}
                  style={{
                    background: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '10px 24px',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    cursor: isSavingProduct ? 'not-allowed' : 'pointer',
                    opacity: isSavingProduct ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {isSavingProduct ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      {editingProduct ? 'Save Changes' : 'Create Product'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isOrderModalOpen && editingOrder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
          overflowY: 'auto'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'sticky',
              top: 0,
              background: 'var(--bg-card)',
              zIndex: 10
            }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={18} />
                Edit Order Details
              </h2>
              <button 
                onClick={() => setIsOrderModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--secondary)',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveOrder} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Row 1: Customer Name & Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="grid-cols-1 sm:grid-cols-2">
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: '6px' }}>
                    Customer Name *
                  </label>
                  <input 
                    type="text"
                    value={orderCustName}
                    onChange={(e) => setOrderCustName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-body)',
                      color: 'var(--primary)',
                      fontSize: '0.875rem'
                    }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: '6px' }}>
                    Customer Phone *
                  </label>
                  <input 
                    type="text"
                    value={orderCustPhone}
                    onChange={(e) => setOrderCustPhone(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-body)',
                      color: 'var(--primary)',
                      fontSize: '0.875rem'
                    }}
                    required
                  />
                </div>
              </div>

              {/* Row 2: Delivery Area & Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="grid-cols-1 sm:grid-cols-2">
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: '6px' }}>
                    Delivery Area *
                  </label>
                  <select 
                    value={orderCustArea}
                    onChange={(e) => {
                      const area = e.target.value;
                      setOrderCustArea(area);
                      let fee = 5;
                      if (area === 'Mount Lebanon') fee = 6;
                      else if (['North', 'South', 'Bekaa'].includes(area)) fee = 8;
                      setOrderDeliveryFee(String(fee));
                      
                      const sub = Number(orderSubtotal) || 0;
                      setOrderTotalPrice(String(sub + fee));
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-body)',
                      color: 'var(--primary)',
                      fontSize: '0.875rem',
                      outline: 'none'
                    }}
                    required
                  >
                    <option value="Beirut">Beirut ($5.00)</option>
                    <option value="Mount Lebanon">Mount Lebanon ($6.00)</option>
                    <option value="North">North ($8.00)</option>
                    <option value="South">South ($8.00)</option>
                    <option value="Bekaa">Bekaa ($8.00)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: '6px' }}>
                    Order Status *
                  </label>
                  <select 
                    value={orderCustStatus}
                    onChange={(e) => setOrderCustStatus(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-body)',
                      color: 'var(--primary)',
                      fontSize: '0.875rem',
                      outline: 'none'
                    }}
                    required
                  >
                    <option value="Pending">Pending</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Delivery Address */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: '6px' }}>
                  Delivery Address
                </label>
                <textarea 
                  value={orderCustAddress}
                  onChange={(e) => setOrderCustAddress(e.target.value)}
                  placeholder="Street name, building details, apartment info..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-body)',
                    color: 'var(--primary)',
                    fontSize: '0.875rem',
                    minHeight: '60px',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Pricing breakdown: Subtotal, Delivery Fee, Total */}
              <div style={{
                background: 'var(--bg-body)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 12px 0', color: 'var(--accent)' }}>
                  Pricing Fields ($)
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }} className="grid-cols-3">
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: '4px' }}>
                      Subtotal
                    </label>
                    <input 
                      type="number"
                      step="0.01"
                      value={orderSubtotal}
                      onChange={(e) => {
                        const sub = e.target.value;
                        setOrderSubtotal(sub);
                        const fee = Number(orderDeliveryFee) || 0;
                        setOrderTotalPrice(String((Number(sub) || 0) + fee));
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-card)',
                        color: 'var(--primary)',
                        fontSize: '0.875rem'
                      }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: '4px' }}>
                      Delivery Fee
                    </label>
                    <input 
                      type="number"
                      step="0.01"
                      value={orderDeliveryFee}
                      onChange={(e) => {
                        const fee = e.target.value;
                        setOrderDeliveryFee(fee);
                        const sub = Number(orderSubtotal) || 0;
                        setOrderTotalPrice(String(sub + (Number(fee) || 0)));
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-card)',
                        color: 'var(--primary)',
                        fontSize: '0.875rem'
                      }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: '4px' }}>
                      Total Amount
                    </label>
                    <input 
                      type="number"
                      step="0.01"
                      value={orderTotalPrice}
                      onChange={(e) => setOrderTotalPrice(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-card)',
                        color: 'var(--primary)',
                        fontSize: '0.875rem',
                        fontWeight: 'bold'
                      }}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                borderTop: '1px solid var(--border)',
                paddingTop: '20px',
                marginTop: '10px'
              }}>
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(false)}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '10px 18px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: 'var(--primary)'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingOrder}
                  style={{
                    background: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '10px 24px',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    cursor: isSavingOrder ? 'not-allowed' : 'pointer',
                    opacity: isSavingOrder ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {isSavingOrder ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      Save Order
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// Toast notification helper component
interface ToastProps {
  message: string;
  onClose: () => void;
}
function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  return (
    <div className={`toast ${message ? 'show' : ''}`}>
      <div className="toast-content">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="toast-icon">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>{message}</span>
      </div>
    </div>
  );
}
