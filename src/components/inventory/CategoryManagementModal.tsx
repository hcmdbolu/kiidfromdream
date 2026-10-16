import React, { useState } from 'react';
import { Tag, Plus, Edit2, Trash2, X, Check, AlertCircle, Layers, Search, AlertTriangle } from 'lucide-react';
import { usePos } from '../../context/PosContext';
import { ProductCategoryItem } from '../../types';

interface CategoryManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoryCreated?: (categoryName: string) => void;
}

export const CategoryManagementModal: React.FC<CategoryManagementModalProps> = ({
  isOpen,
  onClose,
  onCategoryCreated,
}) => {
  const { categories, addCategory, updateCategory, deleteCategory, products } = usePos();

  const [search, setSearch] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filtered categories
  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
  );

  // Count products per category
  const getProductCount = (categoryName: string) => {
    return products.filter(p => p.product_category?.toLowerCase() === categoryName.toLowerCase()).length;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmed = newCatName.trim();
    if (!trimmed) {
      setError('Please provide a category name.');
      return;
    }

    if (categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`A category named "${trimmed}" already exists.`);
      return;
    }

    const res = await addCategory(trimmed, newCatDesc.trim() || undefined);

    if (res.success) {
      setSuccess(`Category "${trimmed}" successfully added!`);
      if (onCategoryCreated) {
        onCategoryCreated(trimmed);
      }
      setNewCatName('');
      setNewCatDesc('');
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(res.error || 'Failed to add category');
    }
  };

  const startEdit = (cat: ProductCategoryItem) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditDesc(cat.description || '');
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDesc('');
    setError(null);
  };

  const handleSaveEdit = async (cat: ProductCategoryItem) => {
    setError(null);
    const trimmed = editName.trim();
    if (!trimmed) {
      setError('Category name cannot be empty.');
      return;
    }

    if (categories.some(c => c.id !== cat.id && c.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`Another category with name "${trimmed}" already exists.`);
      return;
    }

    const res = await updateCategory(cat.id, trimmed, editDesc.trim() || undefined);

    if (res.success) {
      setSuccess(`Category renamed to "${trimmed}". All associated products have been updated.`);
      setEditingId(null);
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(res.error || 'Failed to update category');
    }
  };

  const handleDelete = async (cat: ProductCategoryItem) => {
    setError(null);
    const count = getProductCount(cat.name);
    const confirmMsg = count > 0
      ? `Category "${cat.name}" is currently assigned to ${count} product(s). Are you sure you want to delete it? Those products will remain but will keep the old category name.`
      : `Are you sure you want to delete category "${cat.name}"?`;

    if (window.confirm(confirmMsg)) {
      const res = await deleteCategory(cat.id);
      if (res.success) {
        setSuccess(`Category "${cat.name}" removed.`);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(res.error || 'Failed to delete category');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4.5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Product Categories</h3>
              <p className="text-xs text-slate-400">Add, rename, and manage item classification categories</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          
          {/* Notifications */}
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center space-x-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Quick Add New Category Box */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
              <Tag className="w-4 h-4 text-emerald-600" />
              <span>Create New Category</span>
            </div>

            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    placeholder="e.g. Seafood, Dairy, Spices..."
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={newCatDesc}
                    onChange={e => setNewCatDesc(e.target.value)}
                    placeholder="Short description or department..."
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="flex items-center space-x-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Category</span>
                </button>
              </div>
            </form>
          </div>

          {/* Search Bar & Stats */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search categories..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
              />
            </div>
            <span className="text-xs text-slate-500 font-medium shrink-0">
              {categories.length} total categories
            </span>
          </div>

          {/* Categories Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Category Name</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-center">Assigned Items</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400 text-xs">
                      No categories found.
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map(cat => {
                    const isEditing = editingId === cat.id;
                    const count = getProductCount(cat.name);

                    if (isEditing) {
                      return (
                        <tr key={cat.id} className="bg-amber-50/70">
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              className="w-full px-2 py-1 text-xs bg-white border border-amber-300 rounded font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={editDesc}
                              onChange={e => setEditDesc(e.target.value)}
                              placeholder="Description..."
                              className="w-full px-2 py-1 text-xs bg-white border border-amber-300 rounded text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 font-mono text-[10px] text-slate-700">
                              {count} items
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(cat)}
                                className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                                title="Save changes"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="p-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors"
                                title="Cancel editing"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={cat.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          <div className="flex items-center space-x-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span>{cat.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 max-w-[200px] truncate">
                          {cat.description || <span className="text-slate-300 italic">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[10px] ${
                            count > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {count} item{count === 1 ? '' : 's'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              type="button"
                              onClick={() => startEdit(cat)}
                              className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                              title="Edit / Rename Category (cascades to all items)"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(cat)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                              title="Delete Category"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Cascade Rename Protection:</strong> When you rename a category here, all existing products under that category are automatically updated to reflect the new category name in the database and POS register.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-3 px-5 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
