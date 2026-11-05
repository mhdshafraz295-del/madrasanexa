import React, { useState } from 'react';
import type { ExpenseCategory } from '../../services/expense-analysis.service';
import { Plus, Edit, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface ExpenseCategoryManagerProps {
  categories: ExpenseCategory[];
  onAddCategory: (data: { name: string; description?: string | null }) => Promise<void>;
  onUpdateCategory: (id: string, data: { name?: string; description?: string | null; isActive?: boolean }) => Promise<void>;
}

export const ExpenseCategoryManager: React.FC<ExpenseCategoryManagerProps> = ({
  categories,
  onAddCategory,
  onUpdateCategory,
}) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingCategory(null);
    setName('');
    setDescription('');
    setError(null);
    setIsAddOpen(true);
  };

  const openEditModal = (c: ExpenseCategory) => {
    setEditingCategory(c);
    setName(c.name);
    setDescription(c.description || '');
    setError(null);
    setIsAddOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      if (editingCategory) {
        await onUpdateCategory(editingCategory.id, {
          name: name.trim(),
          description: description.trim() || null,
        });
      } else {
        await onAddCategory({
          name: name.trim(),
          description: description.trim() || null,
        });
      }
      setIsAddOpen(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to save category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (c: ExpenseCategory) => {
    try {
      await onUpdateCategory(c.id, { isActive: !c.isActive });
    } catch (err: any) {
      alert(err?.response?.data?.message || err.message || 'Failed to update status.');
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-[#E7E9EE] shadow-xs overflow-hidden">
      <div className="p-5 border-b border-[#E7E9EE] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[#0F172A]">Operating Expense Categories</h3>
          <p className="text-xs text-[#7C8A9A] mt-0.5">
            Configure outgoing cost classifications (e.g. Food, Gas, Tea, Supplies).
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Category</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-[#F7F6F1] border-b border-[#E7E9EE] text-[#7C8A9A] uppercase tracking-wider text-[10px] font-bold">
              <th className="py-3 px-4">Category Name</th>
              <th className="py-3 px-4">Description</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7E9EE]">
            {categories.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-[#7C8A9A]">
                  <p className="font-semibold text-xs">No categories created yet.</p>
                  <p className="text-[11px] text-[#7C8A9A] mt-0.5">
                    Click &ldquo;New Category&rdquo; to add your first expense category.
                  </p>
                </td>
              </tr>
            ) : (
              categories.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3 px-4 font-bold text-[#0F172A] whitespace-nowrap">{c.name}</td>
                  <td className="py-3 px-4 text-[#7C8A9A]">{c.description || '-'}</td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    {c.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle className="w-3 h-3" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-[#7C8A9A]">
                        <XCircle className="w-3 h-3" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openEditModal(c)}
                        className="p-1.5 text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#E7E9EE] rounded-lg transition cursor-pointer"
                        title="Edit Category"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(c)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                          c.isActive
                            ? 'text-rose-600 hover:bg-rose-50'
                            : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {c.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Category Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-[#E7E9EE]">
            <h3 className="text-sm font-bold text-[#0F172A] mb-3">
              {editingCategory ? 'Edit Category' : 'Create Operating Expense Category'}
            </h3>

            {error && (
              <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Milk Tea, Gas, Kitchen Supplies"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  className="w-full px-3.5 py-2.5 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-semibold focus:outline-hidden focus:border-[#37C6A3]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Operational notes on this category"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  className="w-full px-3.5 py-2.5 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#37C6A3] resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-semibold text-[#7C8A9A] hover:bg-[#F7F6F1] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default ExpenseCategoryManager;
