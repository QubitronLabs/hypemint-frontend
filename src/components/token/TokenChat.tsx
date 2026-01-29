"use client";

/**
 * Token Chat Component - Redesigned
 * Real-time chat with sorting, likes, and comment popup
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	Loader2,
	MessageCircle,
	Heart,
	SlidersHorizontal,
	X,
	ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAuth } from "@/hooks";

interface Comment {
	id: string;
	content: string;
	imageUrl?: string | null;
	createdAt: string;
	likesCount?: number;
	isLiked?: boolean;
	user: {
		id: string;
		username: string | null;
		displayName: string | null;
		avatarUrl: string | null;
	};
}

interface TokenChatProps {
	tokenId: string;
	className?: string;
}

type SortOption = "newest" | "oldest";

export function TokenChat({ tokenId, className }: TokenChatProps) {
	const [comments, setComments] = useState<Comment[]>([]);
	const [sending, setSending] = useState(false);
	const [loading, setLoading] = useState(true);
	const [sortBy, setSortBy] = useState<SortOption>("newest");
	const [showCommentDialog, setShowCommentDialog] = useState(false);
	const [dialogMessage, setDialogMessage] = useState("");
	const [selectedImage, setSelectedImage] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const [parentId, setParentId] = useState<string | null>(null);
	const [replyingTo, setReplyingTo] = useState<string | null>(null);

	const { isAuthenticated, setShowAuthFlow } = useAuth();

	// Initial fetch
	useEffect(() => {
		const fetchComments = async () => {
			try {
				const response = await apiClient.get(
					`/api/v1/comments/token/${tokenId}`,
				);
				if (response.data?.success) {
					// We need to deduplicate because websocket might have added some
					const fetchedComments = response.data.data.comments || [];
					setComments(fetchedComments);
				}
			} catch (error) {
				console.error("Failed to fetch comments:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchComments();
	}, [tokenId]);

	// WebSocket Integration
	const { subscribe, unsubscribe, isConnected } = useWebSocket({
		onMessage: (msg) => {
			if (
				msg.channel === `comments:${tokenId}` &&
				msg.event === "comment"
			) {
				const newComment = msg.data as Comment;
				setComments((prev) => {
					// Update if exists (e.g. like count change - though we only broadcast creation mostly, but if we broadcast update...)
					// Actually our broadcast is creation only right now.
					if (prev.find((c) => c.id === newComment.id)) return prev;
					return [newComment, ...prev];
				});
			}
		},
	});

	useEffect(() => {
		if (isConnected) {
			subscribe(`comments:${tokenId}`);
			return () => unsubscribe(`comments:${tokenId}`);
		}
	}, [tokenId, isConnected, subscribe, unsubscribe]);

	// Sort comments
	const sortedComments = [...comments].sort((a, b) => {
		const dateA = new Date(a.createdAt).getTime();
		const dateB = new Date(b.createdAt).getTime();
		return sortBy === "newest" ? dateB - dateA : dateA - dateB;
	});

	// Handle image selection
	const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			setSelectedImage(file);
			const reader = new FileReader();
			reader.onloadend = () => {
				setImagePreview(reader.result as string);
			};
			reader.readAsDataURL(file);
		}
	};

	// Clear selected image
	const clearImage = () => {
		setSelectedImage(null);
		setImagePreview(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	// Handle like
	const handleLike = async (commentId: string, isLiked: boolean) => {
		if (!isAuthenticated) {
			setShowAuthFlow(true);
			return;
		}

		// Optimistic update
		setComments((prev) =>
			prev.map((c) =>
				c.id === commentId
					? {
							...c,
							isLiked: !isLiked,
							likesCount: isLiked
								? (c.likesCount || 1) - 1
								: (c.likesCount || 0) + 1,
						}
					: c,
			),
		);

		try {
			if (isLiked) {
				await apiClient.delete(`/api/v1/comments/${commentId}/like`);
			} else {
				await apiClient.post(`/api/v1/comments/${commentId}/like`);
			}
		} catch (error) {
			console.error("Failed to like/unlike comment:", error);
			// Revert on failure
			setComments((prev) =>
				prev.map((c) =>
					c.id === commentId
						? {
								...c,
								isLiked: isLiked, // Revert to original
								likesCount: isLiked
									? (c.likesCount || 0) + 1
									: (c.likesCount || 1) - 1,
							}
						: c,
				),
			);
		}
	};

	const handleReply = (comment: Comment) => {
		if (!isAuthenticated) {
			setShowAuthFlow(true);
			return;
		}
		setParentId(comment.id);
		setReplyingTo(comment.user.displayName || comment.user.username || "Anonymous");
		setShowCommentDialog(true);
	};

	// Send message from dialog
	const handleDialogSend = async () => {
		if (!dialogMessage.trim() || !isAuthenticated || sending) return;

		setSending(true);
		try {
			const formData = new FormData();
			formData.append("content", dialogMessage.trim());
			if (selectedImage) {
				formData.append("image", selectedImage);
			}
			if (parentId) {
				formData.append("parentId", parentId);
			}

			const response = await apiClient.post(
				`/api/v1/comments/token/${tokenId}`,
				selectedImage ? formData : { content: dialogMessage.trim(), parentId },
				selectedImage
					? { headers: { "Content-Type": "multipart/form-data" } }
					: undefined,
			);

			if (response.data?.success) {
				setDialogMessage("");
				clearImage();
				setParentId(null);
				setReplyingTo(null);
				setShowCommentDialog(false);
			}
		} catch (error) {
			console.error("Failed to send comment:", error);
		} finally {
			setSending(false);
		}
	};

	// Format timestamp
	const formatTime = (dateStr: string) => {
		const date = new Date(dateStr);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const mins = Math.floor(diff / 60000);

		if (mins < 1) return "Just now";
		if (mins < 60) return `${mins}m`;
		if (mins < 1440) return `${Math.floor(mins / 60)}h`;
		return `${Math.floor(mins / 1440)}d`;
	};

	// Open dialog when input is clicked
	const handleInputClick = () => {
		if (!isAuthenticated) {
			setShowAuthFlow(true);
			return;
		}
		setParentId(null);
		setReplyingTo(null);
		setShowCommentDialog(true);
	};

	return (
		<div className={cn("flex flex-col", className)}>
			{/* Header with Input and Sort */}
			<div className="flex items-center gap-3 p-4 border-b border-border">
				<Avatar className="w-8 h-8 shrink-0">
					<AvatarFallback className="bg-muted text-xs">
						👤
					</AvatarFallback>
				</Avatar>
				<Input
					placeholder="Add a comment..."
					onClick={handleInputClick}
					readOnly
					className="flex-1 bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
				/>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="sm" className="gap-2">
							<SlidersHorizontal className="h-3.5 w-3.5" />
							{sortBy === "newest" ? "Newest" : "Oldest"}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={() => setSortBy("newest")}>
							Newest
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => setSortBy("oldest")}>
							Oldest
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{/* Messages */}
			<div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[500px] min-h-[300px]">
				{loading ? (
					<div className="flex items-center justify-center h-full">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : sortedComments.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full text-muted-foreground">
						<MessageCircle className="h-10 w-10 mb-2 opacity-50" />
						<p className="text-sm">No comments yet</p>
						<p className="text-xs">Be the first to comment!</p>
					</div>
				) : (
					<AnimatePresence mode="popLayout">
						{sortedComments.map((comment) => (
							<motion.div
								key={comment.id}
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, scale: 0.95 }}
								className="flex gap-3"
							>
								<Avatar className="w-8 h-8 flex-shrink-0">
									<AvatarImage
										src={
											comment.user.avatarUrl || undefined
										}
									/>
									<AvatarFallback className="bg-muted text-xs">
										{(
											comment.user.displayName ||
											comment.user.username ||
											"A"
										)
											.slice(0, 2)
											.toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<div className="flex-1 min-w-0">
									<div className="flex items-baseline gap-2 mb-1">
										<span className="font-medium text-sm">
											{comment.user.displayName ||
												comment.user.username ||
												"Anonymous"}
										</span>
										<span className="text-xs text-muted-foreground">
											{formatTime(comment.createdAt)}
										</span>
									</div>

									{/* Image if present */}
									{comment.imageUrl && (
										<div className="mb-2 rounded-lg overflow-hidden max-w-[200px]">
											<img
												src={comment.imageUrl}
												alt="Comment attachment"
												className="w-full h-auto"
											/>
										</div>
									)}

									<p className="text-sm text-foreground/90 break-words">
										{comment.content}
									</p>

									{/* Reply link */}
									<button 
										onClick={() => handleReply(comment)}
										className="text-xs text-muted-foreground hover:text-foreground mt-1"
									>
										Reply
									</button>
								</div>

								{/* Like button */}
								<button
									onClick={() => handleLike(comment.id, !!comment.isLiked)}
									className="flex flex-col items-center gap-0.5 shrink-0"
								>
									<Heart
										className={cn(
											"h-4 w-4 transition-colors",
											comment.isLiked
												? "fill-red-500 text-red-500"
												: "text-muted-foreground hover:text-foreground",
										)}
									/>
									<span className="text-xs text-muted-foreground">
										{comment.likesCount || 0}
									</span>
								</button>
							</motion.div>
						))}
					</AnimatePresence>
				)}
				<div ref={messagesEndRef} />
			</div>

			{/* Comment Dialog */}
			<Dialog
				open={showCommentDialog}
				onOpenChange={(open) => {
					setShowCommentDialog(open);
					if (!open) {
						setParentId(null);
						setReplyingTo(null);
					}
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							{replyingTo ? `Reply to ${replyingTo}` : "Add a comment"}
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<Textarea
							placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
							value={dialogMessage}
							onChange={(e) => setDialogMessage(e.target.value)}
							className="min-h-[100px] bg-muted/50 resize-none"
							maxLength={500}
						/>

						{/* Image upload section */}
						<div>
							<p className="text-sm text-muted-foreground mb-2">
								Image (optional)
							</p>
							<input
								ref={fileInputRef}
								type="file"
								accept="image/*"
								onChange={handleImageSelect}
								className="hidden"
							/>

							{imagePreview ? (
								<div className="relative inline-block">
									<img
										src={imagePreview}
										alt="Preview"
										className="max-w-full max-h-[150px] rounded-lg"
									/>
									<button
										onClick={clearImage}
										className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
									>
										<X className="h-3 w-3" />
									</button>
								</div>
							) : (
								<div
									onClick={() =>
										fileInputRef.current?.click()
									}
									className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-muted-foreground transition-colors"
								>
									<ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
									<p className="text-sm text-muted-foreground">
										Select image to upload
									</p>
									<p className="text-xs text-muted-foreground">
										or drag and drop it here
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
						</div>

						{/* Action buttons */}
						<div className="flex justify-end gap-2">
							<Button
								variant="ghost"
								onClick={() => {
									setShowCommentDialog(false);
									setDialogMessage("");
									clearImage();
									setParentId(null);
									setReplyingTo(null);
								}}
							>
								Cancel
							</Button>
							<Button
								onClick={handleDialogSend}
								disabled={!dialogMessage.trim() || sending}
								className="bg-primary hover:bg-primary/90"
							>
								{sending ? (
									<Loader2 className="h-4 w-4 animate-spin mr-2" />
								) : null}
								{replyingTo ? "Post reply" : "Post comment"}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
