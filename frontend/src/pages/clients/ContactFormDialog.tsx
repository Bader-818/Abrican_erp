import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/Spinner'
import { createContact, updateContact } from '@/api/clients.api'
import { getApiErrorMessage } from '@/lib/api-error'
import type { ClientContact } from '@/types'

const contactFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  role: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  email: z
    .string()
    .refine((value) => value === '' || z.string().email().safeParse(value).success, 'Enter a valid email address'),
})

type ContactFormValues = z.infer<typeof contactFormSchema>

export interface ContactFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
  contact?: ClientContact | null
}

export function ContactFormDialog({ open, onOpenChange, clientId, contact }: ContactFormDialogProps) {
  const mode = contact ? 'edit' : 'create'
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: { name: '', role: '', phone: '', email: '' },
  })

  useEffect(() => {
    if (open) {
      reset({
        name: contact?.name ?? '',
        role: contact?.role ?? '',
        phone: contact?.phone ?? '',
        email: contact?.email ?? '',
      })
    }
  }, [open, contact, reset])

  const mutation = useMutation({
    mutationFn: async (values: ContactFormValues) => {
      const payload = {
        name: values.name,
        role: values.role || undefined,
        phone: values.phone || undefined,
        email: values.email || undefined,
      }
      return mode === 'create'
        ? createContact(clientId, payload)
        : updateContact(clientId, contact!.id, payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clients', clientId] })
      toast.success(mode === 'create' ? 'Contact added' : 'Contact updated')
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to save contact'))
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New contact' : 'Edit contact'}</DialogTitle>
          <DialogDescription>Contact person for this client.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="contact-name">Name</Label>
            <Input id="contact-name" {...register('name')} />
            {errors.name ? <p className="text-xs text-red-600">{errors.name.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact-role">Role / title</Label>
            <Input id="contact-role" {...register('role')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="contact-phone">Phone</Label>
              <Input id="contact-phone" {...register('phone')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-email">Email</Label>
              <Input id="contact-email" type="email" {...register('email')} />
              {errors.email ? <p className="text-xs text-red-600">{errors.email.message}</p> : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? <Spinner /> : null}
              {mode === 'create' ? 'Add contact' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
