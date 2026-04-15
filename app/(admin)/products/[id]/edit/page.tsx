'use client'

import { useParams } from 'next/navigation'
import ProductForm from '@/components/ProductForm'

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>()
  return <ProductForm mode="edit" productId={id} />
}
