"use client";

/**
 * Token Chat Component
 * Real-time chat with collapsible replies
 * Features: Inline input, collapsed replies with "view X more reply", "@mention" display
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	Loader2,
	MessageCircle,
	Heart,
	ChevronUp,
	X,
	Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ImageUploadDialog } from "@/components/ui/image-upload-dialog";
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
	parentId?: string | null;
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
	const [showImageDialog, setShowImageDialog] = useState(false);
	const [inlineMessage, setInlineMessage] = useState("");
	const [selectedImage, setSelectedImage] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const [expandedReplies, setExpandedReplies] = useState<Set<string>>(
		new Set(),
	);
	const inlineInputRef = useRef<HTMLInputElement>(null);
	const topRef = useRef<HTMLDivElement>(null);

	const [parentId, setParentId] = useState<string | null>(null);
	const [replyingTo, setReplyingTo] = useState<string | null>(null);

	const { isAuthenticated, setShowAuthFlow, user } = useAuth();

	// Initial fetch
	useEffect(() => {
		const fetchComments = async () => {
			try {
				const response = await apiClient.get(
					`/api/v1/comments/token/${tokenId}`,
				);
				if (response.data?.success) {
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

	// Organize comments into hierarchical structure
	const parentComments = sortedComments.filter((c) => !c.parentId);
	const repliesMap = new Map<string, Comment[]>();

	sortedComments
		.filter((c) => c.parentId)
		.forEach((reply) => {
			const existing = repliesMap.get(reply.parentId!) || [];
			repliesMap.set(reply.parentId!, [...existing, reply]);
		});

	// Get parent comment user info for @mention
	const getParentUser = (parentId: string) => {
		const parent = comments.find((c) => c.id === parentId);
		return parent?.user.displayName || parent?.user.username || "someone";
	};

	// Get all nested replies flattened (for display when expanded)
	const getAllNestedReplies = (commentId: string): Comment[] => {
		const directReplies = repliesMap.get(commentId) || [];
		const allReplies: Comment[] = [];

		for (const reply of directReplies) {
			allReplies.push(reply);
			// Also add nested replies to this reply
			allReplies.push(...getAllNestedReplies(reply.id));
		}

		return allReplies;
	};

	// Toggle replies visibility
	const toggleReplies = (commentId: string) => {
		setExpandedReplies((prev) => {
			const next = new Set(prev);
			if (next.has(commentId)) {
				next.delete(commentId);
			} else {
				next.add(commentId);
			}
			return next;
		});
	};

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
								isLiked: isLiked,
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
		setReplyingTo(
			comment.user.displayName || comment.user.username || "Anonymous",
		);
		setTimeout(() => inlineInputRef.current?.focus(), 100);
	};

	const clearReply = () => {
		setParentId(null);
		setReplyingTo(null);
	};

	const scrollToTop = () => {
		topRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	// Send comment
	const handleSendComment = async () => {
		if (!inlineMessage.trim() || !isAuthenticated || sending) return;

		setSending(true);
		try {
			const formData = new FormData();
			formData.append("content", inlineMessage.trim());
			if (selectedImage) {
				formData.append("image", selectedImage);
			}
			if (parentId) {
				formData.append("parentId", parentId);
			}

			const response = await apiClient.post(
				`/api/v1/comments/token/${tokenId}`,
				selectedImage
					? formData
					: { content: inlineMessage.trim(), parentId },
				selectedImage
					? { headers: { "Content-Type": "multipart/form-data" } }
					: undefined,
			);

			if (response.data?.success) {
				setInlineMessage("");
				clearImage();
				clearReply();
			}
		} catch (error) {
			console.error("Failed to send comment:", error);
		} finally {
			setSending(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendComment();
		}
	};

	const formatTime = (dateStr: string) => {
		const date = new Date(dateStr);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const mins = Math.floor(diff / 60000);

		if (mins < 1) return "now";
		if (mins < 60) return `${mins}m`;
		if (mins < 1440) return `${Math.floor(mins / 60)}h`;
		return `${Math.floor(mins / 1440)}d`;
	};

	const handleInputFocus = () => {
		if (!isAuthenticated) {
			setShowAuthFlow(true);
		}
	};

	// Render a single comment
	const renderComment = (
		comment: Comment,
		isReply = false,
		parentUsername?: string,
	) => (
		<motion.div
			key={comment.id}
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, scale: 0.95 }}
			className={cn("flex gap-3", isReply && "ml-10")}
		>
			<Avatar className={cn("shrink-0", isReply ? "w-7 h-7" : "w-8 h-8")}>
				<AvatarImage src={comment.user.avatarUrl || undefined} />
				<AvatarFallback className="bg-muted text-xs">
					{(comment.user.displayName || comment.user.username || "A")
						.slice(0, 2)
						.toUpperCase()}
				</AvatarFallback>
			</Avatar>

			<div className="flex-1 min-w-0">
				<div className="flex items-baseline gap-2 mb-0.5">
					<span className="font-medium text-sm">
						{comment.user.displayName ||
							comment.user.username ||
							"Anonymous"}
					</span>
					<span className="text-xs text-muted-foreground">
						{formatTime(comment.createdAt)}
					</span>
				</div>

				{/* Comment content with @mention for replies */}
				<p className="text-sm text-foreground/90 break-words">
					{isReply && parentUsername && (
						<span className="text-primary font-medium">
							@{parentUsername}{" "}
						</span>
					)}
					{comment.content}
				</p>

				{/* Image if present */}
				{comment.imageUrl && (
					<div className="mt-2 rounded-lg overflow-hidden max-w-[200px]">
						<img
							src={comment.imageUrl}
							alt="Comment attachment"
							className="w-full h-auto"
						/>
					</div>
				)}

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
	);

	return (
		<div className={cn("flex flex-col", className)}>
			<div ref={topRef} />

			{/* Top Input Row: Avatar + Input + Newest Dropdown */}
			<div className="flex items-center gap-3 p-4 border-b border-border">
				<Avatar className="w-8 h-8 shrink-0">
					<AvatarImage src={user?.avatarUrl || undefined} />
					<AvatarFallback className="bg-muted text-xs">
						{(user?.displayName || user?.username || "?")
							.slice(0, 2)
							.toUpperCase()}
					</AvatarFallback>
				</Avatar>

				<Input
					ref={inlineInputRef}
					placeholder="Add a comment..."
					value={inlineMessage}
					onChange={(e) => setInlineMessage(e.target.value)}
					onKeyDown={handleKeyDown}
					onFocus={handleInputFocus}
					disabled={sending}
					className="flex-1 bg-transparent border-0 focus-visible:ring-0 text-sm placeholder:text-muted-foreground"
					maxLength={500}
				/>

				{/* Plus button for image */}
				{inlineMessage.trim() && (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={() => setShowImageDialog(true)}
						disabled={sending}
						className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground"
					>
						<Plus className="h-4 w-4" />
					</Button>
				)}

				{/* Send button - only show when there's text */}
				{inlineMessage.trim() && (
					<Button
						type="button"
						size="sm"
						onClick={handleSendComment}
						disabled={sending || !isAuthenticated}
						className="shrink-0 h-8 px-3"
					>
						{sending ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							"Post"
						)}
					</Button>
				)}

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className="shrink-0 gap-1.5 text-muted-foreground"
						>
							<span className="text-sm">
								{sortBy === "newest" ? "Newest" : "Oldest"}
							</span>
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

			{/* Reply indicator + Back to top */}
			{replyingTo && (
				<div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
					<div className="flex items-center gap-2">
						<span className="text-sm text-muted-foreground">
							Reply
						</span>
						<button
							onClick={clearReply}
							className="text-muted-foreground hover:text-foreground"
						>
							<X className="h-3.5 w-3.5" />
						</button>
					</div>
					<button
						onClick={scrollToTop}
						className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
					>
						<ChevronUp className="h-4 w-4" />
						Back to top
					</button>
				</div>
			)}

			{/* Comments List */}
			<div className="flex-1 overflow-y-auto p-4 space-y-5 max-h-[500px] min-h-[300px]">
				{loading ? (
					<div className="flex items-center justify-center h-full">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : parentComments.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full text-muted-foreground">
						<MessageCircle className="h-10 w-10 mb-2 opacity-50" />
						<p className="text-sm">No comments yet</p>
						<p className="text-xs">Be the first to comment!</p>
					</div>
				) : (
					<AnimatePresence mode="popLayout">
						{parentComments.map((comment) => {
							const allReplies = getAllNestedReplies(comment.id);
							const replyCount = allReplies.length;
							const isExpanded = expandedReplies.has(comment.id);

							return (
								<div key={comment.id} className="space-y-4">
									{/* Parent Comment */}
									{renderComment(comment)}

									{/* View replies link or expanded replies */}
									{replyCount > 0 && (
										<>
											{isExpanded ? (
												<>
													{/* Expanded replies - all nested levels */}
													<div className="space-y-4">
														{allReplies.map(
															(reply) =>
																renderComment(
																	reply,
																	true,
																	getParentUser(
																		reply.parentId!,
																	),
																),
														)}
													</div>
													{/* Hide replies link */}
													<button
														onClick={() =>
															toggleReplies(
																comment.id,
															)
														}
														className="flex items-center gap-2 ml-10 text-xs text-muted-foreground hover:text-foreground"
													>
														<span className="w-6 h-px bg-muted-foreground/30" />
														hide replies
													</button>
												</>
											) : (
												/* View replies link */
												<button
													onClick={() =>
														toggleReplies(
															comment.id,
														)
													}
													className="flex items-center gap-2 ml-10 text-xs text-muted-foreground hover:text-foreground"
												>
													<span className="w-6 h-px bg-muted-foreground/30" />
													view {replyCount} more{" "}
													{replyCount === 1
														? "reply"
														: "replies"}
												</button>
											)}
										</>
									)}
								</div>
							);
						})}
					</AnimatePresence>
				)}
			</div>

			{/* Image Upload Dialog */}
			<ImageUploadDialog
				open={showImageDialog}
				onOpenChange={setShowImageDialog}
				imagePreview={imagePreview}
				onImageSelect={handleImageSelect}
				onClearImage={clearImage}
				onConfirm={() => {}}
			/>
		</div>
	);
}
