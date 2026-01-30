"use client";

/**
 * Image Upload Dialog Component
 * A reusable shadcn dialog for selecting and previewing images
 */

import { useRef } from "react";
import { ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface ImageUploadDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	imagePreview: string | null;
	onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onClearImage: () => void;
	onConfirm: () => void;
}

export function ImageUploadDialog({
	open,
	onOpenChange,
	imagePreview,
	onImageSelect,
	onClearImage,
	onConfirm,
}: ImageUploadDialogProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleCancel = () => {
		onClearImage();
		onOpenChange(false);
	};

	const handleConfirm = () => {
		onConfirm();
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Upload Image</DialogTitle>
				</DialogHeader>

				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					onChange={onImageSelect}
					className="hidden"
				/>

				<div className="space-y-4">
					{imagePreview ? (
						<div className="relative">
							<img
								src={imagePreview}
								alt="Preview"
								className="max-w-full max-h-[200px] rounded-lg mx-auto"
							/>
							<button
								onClick={onClearImage}
								className="absolute top-2 right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90 transition-colors"
							>
								<X className="h-3 w-3" />
							</button>
						</div>
					) : (
						<div
							onClick={() => fileInputRef.current?.click()}
							className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-muted-foreground transition-colors"
						>
							<ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
							<p className="text-sm text-muted-foreground">
								Select image to upload
							</p>
							<p className="text-xs text-muted-foreground mt-1">
								PNG, JPG, GIF up to 5MB
							</p>
							<Button
								variant="outline"
								size="sm"
								className="mt-3"
								onClick={(e) => {
									e.stopPropagation();
									fileInputRef.current?.click();
								}}
							>
								Select file
							</Button>
						</div>
					)}

					<div className="flex justify-end gap-2 pt-2">
						<Button variant="ghost" onClick={handleCancel}>
							Cancel
						</Button>
						<Button
							onClick={handleConfirm}
							disabled={!imagePreview}
						>
							OK
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
