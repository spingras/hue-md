;;; hue-markdown-mode.el --- Hue Markdown (.hue.md) mode for Emacs & Android -*- lexical-binding: t; -*-

;; Author: Hue Markdown Contributors
;; Version: 0.1.0
;; Package-Requires: ((emacs "27.1"))
;; Keywords: markdown, faces, convenience, wp
;; URL: https://hue-md.dev

;;; Commentary:

;; Full support for Hue Markdown (`.hue.md`) across Desktop Emacs and
;; Android Emacs (native `org.gnu.emacs` GUI port and Termux Emacs).
;;
;; Zero external dependencies required:
;; - 100% pure-Elisp live overlay coloring for Hue inline spans
;;   (`{red: text}`, `{warn: 71%}`, `{blue bg-gray: text}`, `{#c0ffee: hex}`)
;;   and drawn boxes (Unicode `┌──┐`, rounded `╭──╮`, ASCII `+--+`).
;; - Exact WCAG AA light and dark palettes from `src/palette.js`, adapting
;;   automatically to your Emacs theme (`light` vs `dark` frame background).
;; - Works on top of `markdown-mode` / `gfm-mode` (if installed) or standalone
;;   in vanilla Emacs with built-in Markdown highlighting.
;; - Touch-friendly Menu Bar (`Hue` menu) and box/span authoring helpers for
;;   Android soft keyboards (wrap region in span, draw/rewrap Unicode boxes
;;   without typing box-drawing characters manually).
;; - Pure-Elisp in-Emacs preview (`C-c C-h p`) and GitHub Markdown downgrade
;;   (`C-c C-h d`), with optional `md-hue` CLI acceleration when Node.js is
;;   available.

;;; Code:

(require 'cl-lib)
(require 'easymenu)

(defgroup hue-markdown nil
  "Support for Hue Markdown (`.hue.md`) documents."
  :group 'text
  :prefix "hue-markdown-")

(defcustom hue-markdown-conceal-delimiters nil
  "When non-nil, conceal `{spec: ' and closing `}' delimiters in spans."
  :type 'boolean
  :group 'hue-markdown)

(defcustom hue-markdown-cli-command "md-hue"
  "Path or command name for the optional `md-hue' CLI tool."
  :type 'string
  :group 'hue-markdown)

;; ---------------------------------------------------------------------------
;; Palette & Faces (exact match with src/palette.js)
;; ---------------------------------------------------------------------------

(defconst hue-markdown-palette
  '((red    :light-fg "#b42318" :light-bg "#fde8e7" :dark-fg "#ff7b72" :dark-bg "#3d1614")
    (orange :light-fg "#b54708" :light-bg "#fdeedc" :dark-fg "#ffa657" :dark-bg "#3b2410")
    (yellow :light-fg "#7a5a00" :light-bg "#fdf6d3" :dark-fg "#e3b341" :dark-bg "#362b0a")
    (green  :light-fg "#067647" :light-bg "#dcf5e7" :dark-fg "#3fb950" :dark-bg "#0f2e1c")
    (blue   :light-fg "#175cd3" :light-bg "#e0ecfd" :dark-fg "#58a6ff" :dark-bg "#0f2444")
    (purple :light-fg "#6941c6" :light-bg "#efe7fd" :dark-fg "#d2a8ff" :dark-bg "#2a1b45")
    (gray   :light-fg "#57606a" :light-bg "#eef0f2" :dark-fg "#8b949e" :dark-bg "#21262d"))
  "Hue Markdown color palette for light and dark backgrounds.")

(defconst hue-markdown-semantic-alist
  '(("danger" . red)
    ("!"      . red)
    ("warn"   . orange)
    ("ok"     . green)
    ("info"   . blue)
    ("note"   . purple)
    ("muted"  . gray))
  "Semantic token aliases mapping to canonical Hue palette symbols.")

(defface hue-markdown-delimiter-face
  '((((background light)) :foreground "#57606a")
    (((background dark))  :foreground "#8b949e"))
  "Face used for `{spec: ' and `}' span delimiters."
  :group 'hue-markdown)

(defface hue-markdown-red-fg-face
  '((((background light)) :foreground "#b42318")
    (((background dark))  :foreground "#ff7b72"))
  "Hue red foreground face." :group 'hue-markdown)

(defface hue-markdown-orange-fg-face
  '((((background light)) :foreground "#b54708")
    (((background dark))  :foreground "#ffa657"))
  "Hue orange foreground face." :group 'hue-markdown)

(defface hue-markdown-yellow-fg-face
  '((((background light)) :foreground "#7a5a00")
    (((background dark))  :foreground "#e3b341"))
  "Hue yellow foreground face." :group 'hue-markdown)

(defface hue-markdown-green-fg-face
  '((((background light)) :foreground "#067647")
    (((background dark))  :foreground "#3fb950"))
  "Hue green foreground face." :group 'hue-markdown)

(defface hue-markdown-blue-fg-face
  '((((background light)) :foreground "#175cd3")
    (((background dark))  :foreground "#58a6ff"))
  "Hue blue foreground face." :group 'hue-markdown)

(defface hue-markdown-purple-fg-face
  '((((background light)) :foreground "#6941c6")
    (((background dark))  :foreground "#d2a8ff"))
  "Hue purple foreground face." :group 'hue-markdown)

(defface hue-markdown-gray-fg-face
  '((((background light)) :foreground "#57606a")
    (((background dark))  :foreground "#8b949e"))
  "Hue gray foreground face." :group 'hue-markdown)

(defface hue-markdown-red-bg-face
  '((((background light)) :background "#fde8e7" :extend t)
    (((background dark))  :background "#3d1614" :extend t))
  "Hue red background face." :group 'hue-markdown)

(defface hue-markdown-orange-bg-face
  '((((background light)) :background "#fdeedc" :extend t)
    (((background dark))  :background "#3b2410" :extend t))
  "Hue orange background face." :group 'hue-markdown)

(defface hue-markdown-yellow-bg-face
  '((((background light)) :background "#fdf6d3" :extend t)
    (((background dark))  :background "#362b0a" :extend t))
  "Hue yellow background face." :group 'hue-markdown)

(defface hue-markdown-green-bg-face
  '((((background light)) :background "#dcf5e7" :extend t)
    (((background dark))  :background "#0f2e1c" :extend t))
  "Hue green background face." :group 'hue-markdown)

(defface hue-markdown-blue-bg-face
  '((((background light)) :background "#e0ecfd" :extend t)
    (((background dark))  :background "#0f2444" :extend t))
  "Hue blue background face." :group 'hue-markdown)

(defface hue-markdown-purple-bg-face
  '((((background light)) :background "#efe7fd" :extend t)
    (((background dark))  :background "#2a1b45" :extend t))
  "Hue purple background face." :group 'hue-markdown)

(defface hue-markdown-gray-bg-face
  '((((background light)) :background "#eef0f2" :extend t)
    (((background dark))  :background "#21262d" :extend t))
  "Hue gray background face." :group 'hue-markdown)

(defun hue-markdown--fg-face (color-sym)
  "Return the foreground face symbol for COLOR-SYM."
  (intern (format "hue-markdown-%s-fg-face" color-sym)))

(defun hue-markdown--bg-face (color-sym)
  "Return the background face symbol for COLOR-SYM."
  (intern (format "hue-markdown-%s-bg-face" color-sym)))

;; ---------------------------------------------------------------------------
;; Core Token, Spec & Box Parser (matches src/core.js)
;; ---------------------------------------------------------------------------

(defconst hue-markdown--hex-regexp
  "\\`#\\(?:[0-9a-fA-F]\\{3\\}\\|[0-9a-fA-F]\\{6\\}\\)\\'"
  "Regexp matching valid 3-digit or 6-digit hex color tokens.")

(defun hue-markdown-resolve-color (name)
  "Resolve token NAME to a canonical palette symbol, or nil."
  (let ((sym (intern-soft name)))
    (cond
     ((and sym (assq sym hue-markdown-palette)) sym)
     ((cdr (assoc name hue-markdown-semantic-alist)))
     (t nil))))

(defun hue-markdown--apply-word (style word &optional allow-hex)
  "Apply single token WORD onto plist STYLE.
If ALLOW-HEX is non-nil, `#rgb' and `#rrggbb' tokens are accepted.
Returns updated STYLE plist, or nil if WORD is not a valid Hue token."
  (let* ((is-bg (string-prefix-p "bg-" word))
         (val (if is-bg (substring word 3) word)))
    (cond
     ((string-match-p hue-markdown--hex-regexp val)
      (when allow-hex
        (if is-bg
            (plist-put (plist-put (copy-sequence style) :bg-hex val) :bg nil)
          (plist-put (plist-put (copy-sequence style) :fg-hex val) :fg nil))))
     (t
      (let ((c (hue-markdown-resolve-color val)))
        (when c
          (if is-bg
              (plist-put (plist-put (copy-sequence style) :bg c) :bg-hex nil)
            (plist-put (plist-put (copy-sequence style) :fg c) :fg-hex nil))))))))

(defun hue-markdown-parse-spec (spec)
  "Parse space-separated style SPEC string (max 64 chars).
Return plist `(:fg SYM :bg SYM :fg-hex STR :bg-hex STR)' or nil."
  (when (and (stringp spec) (> (length spec) 0) (<= (length spec) 64))
    (let ((words (split-string (string-trim spec) "[ \t\r\n]+" t))
          (style (list :fg nil :bg nil :fg-hex nil :bg-hex nil))
          (ok t))
      (when words
        (dolist (w words)
          (when ok
            (let ((next (hue-markdown--apply-word style w t)))
              (if next
                  (setq style next)
                (setq ok nil)))))
        (and ok style)))))

(defun hue-markdown--style-to-face-spec (style &optional box-border-p)
  "Convert parsed Hue STYLE plist to an Emacs face specification.
When BOX-BORDER-P is non-nil, a background-only box uses its color for
the border/title foreground as well."
  (let ((fg (plist-get style :fg))
        (bg (plist-get style :bg))
        (fg-hex (plist-get style :fg-hex))
        (bg-hex (plist-get style :bg-hex))
        (faces nil))
    (when (and box-border-p (not fg) (not fg-hex) bg)
      (setq fg bg))
    (when bg
      (push (hue-markdown--bg-face bg) faces))
    (when bg-hex
      (push (list :background bg-hex :extend t) faces))
    (when fg
      (push (hue-markdown--fg-face fg) faces))
    (when fg-hex
      (push (list :foreground fg-hex) faces))
    (cond
     ((null faces) nil)
     ((= (length faces) 1) (car faces))
     (t (nreverse faces)))))

(defconst hue-markdown--box-top-regexp
  "\\`\\([┌╭+]\\)\\([─-]+\\)\\(.*?\\)[ \t]*\\'"
  "Regexp matching a Hue box top border line (after up to 3 spaces indent).")

(defconst hue-markdown--box-bottom-regexp
  "\\`\\(?:[└╰][─-]+[┘╯]?\\|\\+[─-]+\\+?\\)[ \t]*\\'"
  "Regexp matching a Hue box bottom border line.")

(defun hue-markdown-parse-top-border (line)
  "Parse top border LINE (without leading indent).
Return plist `(:style STYLE :title TITLE :corners CORNERS)' or nil."
  (when (string-match hue-markdown--box-top-regexp line)
    (let* ((left (match-string 1 line))
           (dashes (match-string 2 line))
           (rest (string-trim-right (or (match-string 3 line) "")))
           (right nil))
      (when (> (length rest) 0)
        (let ((last-ch (substring rest (1- (length rest)))))
          (when (member last-ch '("┐" "╮" "+"))
            (setq right last-ch)
            (setq rest (substring rest 0 (1- (length rest)))))))
      (when (or (null right)
                (eq (string= left "+") (string= right "+")))
        (let* ((raw (concat dashes rest))
               (trimmed (replace-regexp-in-string
                         "\\`[─ \t-]+\\|[─ \t-]+\\'" "" raw))
               (words (if (string-empty-p trimmed)
                          nil
                        (split-string trimmed "[ \t]+" t)))
               (style (list :fg nil :bg nil :fg-hex nil :bg-hex nil))
               (i 0)
               (n (length words)))
          (while (and (< i n)
                      (let ((next (hue-markdown--apply-word style (nth i words) nil)))
                        (when next
                          (setq style next)
                          t)))
            (setq i (1+ i)))
          (let ((fg (plist-get style :fg))
                (bg (plist-get style :bg)))
            (cond
             ((and (not fg) (not bg))
              (setq style (plist-put (plist-put style :fg 'gray) :bg 'gray)))
             ((and fg (not bg))
              (setq style (plist-put style :bg fg)))
             ((and bg (not fg))
              (setq style (plist-put style :fg bg)))))
          (list :style style
                :title (mapconcat #'identity (nthcdr i words) " ")
                :corners (cond ((string= left "╭") 'round)
                               ((string= left "+") 'ascii)
                               (t 'square))))))))

(defun hue-markdown--bottom-border-p (line corners)
  "Return non-nil if LINE is a valid bottom border matching CORNERS."
  (when (string-match hue-markdown--box-bottom-regexp line)
    (let ((is-ascii (string-prefix-p "+" line)))
      (if (eq corners 'ascii)
          is-ascii
        (not is-ascii)))))

(defun hue-markdown--side-line-p (line)
  "Return non-nil if LINE starts with a Hue box side border (`│' or `|')."
  (and (> (length line) 0)
       (memq (aref line 0) '(?│ ?|))))

;; ---------------------------------------------------------------------------
;; Buffer Overlay Scanner (Spans & Drawn Boxes)
;; ---------------------------------------------------------------------------

(defun hue-markdown--clear-overlays (&optional beg end)
  "Remove all `hue-markdown' overlays between BEG and END."
  (remove-overlays (or beg (point-min)) (or end (point-max)) 'hue-markdown t))

(defun hue-markdown--make-overlay (beg end face &optional priority evaporate)
  "Create a `hue-markdown' overlay from BEG to END with FACE."
  (when (and (< beg end) face)
    (let ((ov (make-overlay beg end nil t nil)))
      (overlay-put ov 'hue-markdown t)
      (overlay-put ov 'face face)
      (when priority
        (overlay-put ov 'priority priority))
      (when evaporate
        (overlay-put ov 'evaporate t))
      ov)))

(defun hue-markdown--make-delimiter-overlay (beg end &optional priority)
  "Style or conceal span delimiter between BEG and END."
  (when (< beg end)
    (let ((ov (make-overlay beg end nil t nil)))
      (overlay-put ov 'hue-markdown t)
      (overlay-put ov 'face 'hue-markdown-delimiter-face)
      (when priority
        (overlay-put ov 'priority priority))
      (when hue-markdown-conceal-delimiters
        (overlay-put ov 'invisible 'hue-markdown-delimiter))
      ov)))

(defun hue-markdown--scan-inline-spans (text line-pos start-idx end-idx &optional depth)
  "Scan TEXT between START-IDX and END-IDX for Hue inline spans.
LINE-POS is the buffer position corresponding to index 0 of TEXT."
  (let ((i start-idx)
        (prio (+ 20 (* 5 (or depth 0)))))
    (while (< i end-idx)
      (let ((ch (aref text i)))
        (cond
         ;; Skip inline code spans `...`
         ((eq ch ?`)
          (let ((ticks 0))
            (while (and (< (+ i ticks) end-idx)
                        (eq (aref text (+ i ticks)) ?`))
              (setq ticks (1+ ticks)))
            (let ((close (+ i ticks)))
              (while (< close end-idx)
                (if (eq (aref text close) ?`)
                    (let ((cticks 0))
                      (while (and (< (+ close cticks) end-idx)
                                  (eq (aref text (+ close cticks)) ?`))
                        (setq cticks (1+ cticks)))
                      (if (= cticks ticks)
                          (setq close (+ close cticks)
                                ticks -1)
                        (setq close (+ close cticks))))
                  (setq close (1+ close)))
                (when (= ticks -1)
                  (setq i close)
                  (setq close end-idx)))
              (unless (= ticks -1)
                (setq i end-idx)))))

         ;; Skip escaped character
         ((and (eq ch ?\\) (< (1+ i) end-idx))
          (setq i (+ i 2)))

         ;; Potential `{spec: body}` span
         ((eq ch ?{)
          (let ((colon-idx nil)
                (max-colon (min end-idx (+ i 1 64)))
                (k (1+ i))
                (abort nil))
            (while (and (< k max-colon) (not colon-idx) (not abort))
              (let ((c (aref text k)))
                (cond
                 ((memq c '(?\r ?\n ?{ ?} ?`)) (setq abort t))
                 ((eq c ?:) (setq colon-idx k))))
              (setq k (1+ k)))
            (if (and colon-idx
                     (< (1+ colon-idx) end-idx)
                     (memq (aref text (1+ colon-idx)) '(?\s ?\t ?\r ?\n)))
                (let* ((spec-str (substring text (1+ i) colon-idx))
                       (style (hue-markdown-parse-spec spec-str)))
                  (if (not style)
                      (setq i (1+ i))
                    ;; Find matching `}` with balanced braces
                    (let ((body-start (+ colon-idx 2))
                          (brace-depth 1)
                          (p (+ colon-idx 2))
                          (close-brace nil))
                      (while (and (< p end-idx) (not close-brace))
                        (let ((pc (aref text p)))
                          (cond
                           ((and (eq pc ?\\) (< (1+ p) end-idx))
                            (setq p (1+ p)))
                           ((eq pc ?{)
                            (setq brace-depth (1+ brace-depth)))
                           ((eq pc ?})
                            (setq brace-depth (1- brace-depth))
                            (when (= brace-depth 0)
                              (setq close-brace p)))))
                        (setq p (1+ p)))
                      (if (and close-brace (> close-brace body-start))
                          (let ((face-spec (hue-markdown--style-to-face-spec style nil)))
                            (hue-markdown--make-delimiter-overlay
                             (+ line-pos i) (+ line-pos body-start) prio)
                            (hue-markdown--make-delimiter-overlay
                             (+ line-pos close-brace) (+ line-pos close-brace 1) prio)
                            (hue-markdown--make-overlay
                             (+ line-pos body-start) (+ line-pos close-brace)
                             face-spec prio t)
                            ;; Recursively color nested spans
                            (hue-markdown--scan-inline-spans
                             text line-pos body-start close-brace (1+ (or depth 0)))
                            (setq i (1+ close-brace)))
                        (setq i (1+ i))))))
              (setq i (1+ i)))))

         (t
          (setq i (1+ i))))))))

(defun hue-markdown-fontify-buffer ()
  "Re-scan the current buffer and apply Hue Markdown overlays."
  (interactive)
  (save-excursion
    (save-restriction
      (widen)
      (hue-markdown--clear-overlays (point-min) (point-max))
      (goto-char (point-min))
      (let ((lines nil)
            (in-fence nil)
            (is-hue-fence nil)
            (fence-char nil)
            (fence-len 0))
        ;; Collect line bounds
        (while (not (eobp))
          (let ((lb (line-beginning-position))
                (le (line-end-position)))
            (push (cons lb le) lines))
          (forward-line 1))
        (setq lines (nreverse lines))
        (let ((vec (vconcat lines))
              (idx 0)
              (total (length lines)))
          (while (< idx total)
            (let* ((bounds (aref vec idx))
                   (lb (car bounds))
                   (le (cdr bounds))
                   (line-str (buffer-substring-no-properties lb le))
                   (llen (length line-str))
                   (indent 0))
              (while (and (< indent llen) (< indent 3) (eq (aref line-str indent) ?\s))
                (setq indent (1+ indent)))
              (let ((trimmed (substring line-str indent)))
                (cond
                 ;; Check fenced code block open/close
                 ((string-match "\\`\\(`\\{3,\\}\\|~\\{3,\\}\\)\\(.*\\)\\'" trimmed)
                  (let* ((fence (match-string 1 trimmed))
                         (info (string-trim (match-string 2 trimmed)))
                         (fc (aref fence 0))
                         (flen (length fence)))
                    (if (not in-fence)
                        (setq in-fence t
                              fence-char fc
                              fence-len flen
                              is-hue-fence (string-match-p "\\`hue\\(?:[ \t]\\|\\'\\)" info))
                      (when (and (eq fc fence-char) (>= flen fence-len))
                        (setq in-fence nil
                              is-hue-fence nil))))
                  (setq idx (1+ idx)))

                 ;; Inside non-Hue fenced code block: skip
                 ((and in-fence (not is-hue-fence))
                  (setq idx (1+ idx)))

                 ;; Check for drawn box start
                 (t
                  (let ((top-info (hue-markdown-parse-top-border trimmed))
                        (close-idx nil))
                    (if top-info
                        (let ((corners (plist-get top-info :corners))
                              (k (1+ idx))
                              (valid t))
                          (while (and (< k total) (not close-idx) valid)
                            (let* ((kb (aref vec k))
                                   (kstr (buffer-substring-no-properties (car kb) (cdr kb)))
                                   (ki 0))
                              (while (and (< ki (length kstr))
                                          (<= ki indent)
                                          (eq (aref kstr ki) ?\s))
                                (setq ki (1+ ki)))
                              (let ((ktrim (substring kstr ki)))
                                (cond
                                 ((hue-markdown--bottom-border-p ktrim corners)
                                  (setq close-idx k))
                                 ((hue-markdown--side-line-p ktrim)
                                  nil)
                                 (t
                                  (setq valid nil)))))
                            (setq k (1+ k)))
                          (if close-idx
                              (let* ((box-style (plist-get top-info :style))
                                     (border-face (hue-markdown--style-to-face-spec box-style t))
                                     (bg-only-style (list :fg nil :bg (plist-get box-style :bg)
                                                          :fg-hex nil :bg-hex nil))
                                     (bg-face (hue-markdown--style-to-face-spec bg-only-style nil))
                                     (fg-only-style (list :fg (plist-get box-style :fg) :bg nil
                                                          :fg-hex nil :bg-hex nil))
                                     (fg-face (hue-markdown--style-to-face-spec fg-only-style nil)))
                                ;; Top border
                                (hue-markdown--make-overlay (+ lb indent) le border-face 10 t)
                                ;; Interior lines
                                (cl-loop for m from (1+ idx) below close-idx do
                                         (let* ((mb (aref vec m))
                                                (mlb (car mb))
                                                (mle (cdr mb))
                                                (mstr (buffer-substring-no-properties mlb mle))
                                                (mi 0))
                                           (while (and (< mi (length mstr))
                                                       (<= mi indent)
                                                       (eq (aref mstr mi) ?\s))
                                             (setq mi (1+ mi)))
                                           (hue-markdown--make-overlay (+ mlb mi) mle bg-face 10 t)
                                           ;; Color left and right borders in box fg
                                           (when (< mi (length mstr))
                                             (hue-markdown--make-overlay
                                              (+ mlb mi) (+ mlb mi 1) fg-face 15 t))
                                           (when (string-match "[│|][ \t]*\\'" mstr)
                                             (let ((rb (+ mlb (match-beginning 0))))
                                               (hue-markdown--make-overlay
                                                rb (1+ rb) fg-face 15 t)))
                                           ;; Scan interior line for inline spans
                                           (hue-markdown--scan-inline-spans
                                            mstr mlb mi (length mstr) 1)))
                                ;; Bottom border
                                (let* ((bb (aref vec close-idx))
                                       (blb (car bb))
                                       (ble (cdr bb))
                                       (bstr (buffer-substring-no-properties blb ble))
                                       (bi 0))
                                  (while (and (< bi (length bstr))
                                              (<= bi indent)
                                              (eq (aref bstr bi) ?\s))
                                    (setq bi (1+ bi)))
                                  (hue-markdown--make-overlay (+ blb bi) ble border-face 10 t))
                                (setq idx (1+ close-idx)))
                            ;; Unclosed box top line -> scan as ordinary line
                            (hue-markdown--scan-inline-spans line-str lb 0 llen 0)
                            (setq idx (1+ idx))))
                      ;; Ordinary line
                      (hue-markdown--scan-inline-spans line-str lb 0 llen 0)
                      (setq idx (1+ idx))))))))))))))

;; ---------------------------------------------------------------------------
;; Live Change Hook (debounced for smooth typing on Android & Desktop)
;; ---------------------------------------------------------------------------

(defvar-local hue-markdown--refresh-timer nil)

(defun hue-markdown--schedule-refresh (&rest _)
  "Schedule a fast buffer re-fontification after edits."
  (when hue-markdown--refresh-timer
    (cancel-timer hue-markdown--refresh-timer))
  (let ((buf (current-buffer)))
    (setq hue-markdown--refresh-timer
          (run-with-idle-timer
           0.08 nil
           (lambda ()
             (when (buffer-live-p buf)
               (with-current-buffer buf
                 (when (or (bound-and-true-p hue-markdown-mode)
                           (derived-mode-p 'hue-markdown-major-mode))
                   (hue-markdown-fontify-buffer)))))))))

;; ---------------------------------------------------------------------------
;; Touch / Keyboard Authoring Commands (Span & Box Builders)
;; ---------------------------------------------------------------------------

(defconst hue-markdown-common-specs
  '("!" "warn" "ok" "info" "note" "muted"
    "red" "orange" "yellow" "green" "blue" "purple" "gray"
    "bg-yellow" "bg-red" "bg-orange" "bg-green" "bg-blue" "bg-purple" "bg-gray"
    "blue bg-gray" "red bg-red" "green bg-green")
  "Completion candidates for interactive Hue span/box prompts.")

(defun hue-markdown-insert-span (spec &optional beg end)
  "Wrap active region (BEG..END) or word at point in `{SPEC: ...}'."
  (interactive
   (list (completing-read "Hue style (e.g. warn, !, ok, blue bg-gray): "
                          hue-markdown-common-specs nil nil nil nil "warn")
         (when (use-region-p) (region-beginning))
         (when (use-region-p) (region-end))))
  (let ((text (cond
               ((and beg end (< beg end))
                (delete-and-extract-region beg end))
               ((bounds-of-thing-at-point 'word)
                (let ((b (bounds-of-thing-at-point 'word)))
                  (delete-and-extract-region (car b) (cdr b))))
               (t ""))))
    (insert "{" spec ": " text "}")
    (when (string-empty-p text)
      (backward-char 1))
    (hue-markdown-fontify-buffer)))

(defun hue-markdown-insert-box (style title &optional corners beg end)
  "Wrap region (BEG..END) or current line in a drawn Hue box.
Particularly helpful on Android soft keyboards where `┌', `│', and `┘'
are slow to type manually."
  (interactive
   (list (completing-read "Box token (!, warn, info, ok, note, gray): "
                          '("!" "warn" "info" "ok" "note" "muted"
                            "red" "orange" "yellow" "green" "blue" "purple" "gray")
                          nil nil nil nil "info")
         (read-string "Box title (optional): ")
         (intern (completing-read "Box corners (square, round, ascii): "
                                  '("square" "round" "ascii") nil t nil nil "square"))
         (when (use-region-p) (region-beginning))
         (when (use-region-p) (region-end))))
  (let* ((corners (or corners 'square))
         (tl (pcase corners ('round "╭") ('ascii "+") (_ "┌")))
         (tr (pcase corners ('round "╮") ('ascii "+") (_ "┐")))
         (bl (pcase corners ('round "╰") ('ascii "+") (_ "└")))
         (br (pcase corners ('round "╯") ('ascii "+") (_ "┘")))
         (hz (if (eq corners 'ascii) "-" "─"))
         (vt (if (eq corners 'ascii) "|" "│"))
         (body (cond
                ((and beg end (< beg end))
                 (delete-and-extract-region beg end))
                (t
                 (let ((lb (line-beginning-position))
                       (le (line-end-position)))
                   (delete-and-extract-region lb le)))))
         (raw-lines (split-string (string-trim-right body "\n") "\r?\n"))
         (lines (if (and (= (length raw-lines) 1) (string-empty-p (car raw-lines)))
                    (list "Content here")
                  raw-lines))
         (label-words (delq nil (list (and (not (string-empty-p (string-trim style)))
                                           (string-trim style))
                                      (and (not (string-empty-p (string-trim title)))
                                           (string-trim title)))))
         (label-str (if label-words
                        (concat " " (mapconcat #'identity label-words " ") " ")
                      ""))
         (max-line-w (apply #'max 0 (mapcar #'string-width lines)))
         (min-inner-w (max (+ max-line-w 2) (+ (string-width label-str) 4) 24))
         (top-dashes-right (max 1 (- min-inner-w 1 (string-width label-str))))
         (top-line (concat tl hz label-str (make-string top-dashes-right (aref hz 0)) tr))
         (bot-line (concat bl (make-string min-inner-w (aref hz 0)) br))
         (out-lines (list top-line)))
    (dolist (ln lines)
      (let ((pad (max 0 (- min-inner-w 2 (string-width ln)))))
        (push (concat vt " " ln (make-string pad ?\s) " " vt) out-lines)))
    (push bot-line out-lines)
    (insert (mapconcat #'identity (nreverse out-lines) "\n"))
    (hue-markdown-fontify-buffer)))

(defun hue-markdown-toggle-conceal ()
  "Toggle concealment of `{spec: ' and `}' span delimiters."
  (interactive)
  (setq hue-markdown-conceal-delimiters (not hue-markdown-conceal-delimiters))
  (if hue-markdown-conceal-delimiters
      (add-to-invisibility-spec 'hue-markdown-delimiter)
    (remove-from-invisibility-spec 'hue-markdown-delimiter))
  (hue-markdown-fontify-buffer)
  (message "Hue delimiter concealment %s"
           (if hue-markdown-conceal-delimiters "enabled" "disabled")))

;; ---------------------------------------------------------------------------
;; Pure-Elisp Downgrade to GitHub Markdown (matches md-hue downgrade)
;; ---------------------------------------------------------------------------

(defun hue-markdown--box-alert-kind (color-sym)
  "Map Hue box COLOR-SYM to a GitHub Markdown alert keyword."
  (pcase color-sym
    ('red    "CAUTION")
    ('orange "WARNING")
    ('yellow "WARNING")
    ('green  "TIP")
    ('blue   "NOTE")
    ('purple "IMPORTANT")
    (_       "NOTE")))

(defun hue-markdown--downgrade-spans-in-line (line)
  "Downgrade Hue inline spans in LINE to GitHub-compatible Markdown.
Red and orange spans become `**bold**'; other spans become plain text."
  (let ((i 0)
        (n (length line))
        (out ""))
    (while (< i n)
      (let ((ch (aref line i)))
        (if (not (eq ch ?{))
            (progn
              (setq out (concat out (char-to-string ch)))
              (setq i (1+ i)))
          (let ((colon-idx nil)
                (max-colon (min n (+ i 1 64)))
                (k (1+ i))
                (abort nil))
            (while (and (< k max-colon) (not colon-idx) (not abort))
              (let ((c (aref line k)))
                (cond
                 ((memq c '(?\r ?\n ?{ ?} ?`)) (setq abort t))
                 ((eq c ?:) (setq colon-idx k))))
              (setq k (1+ k)))
            (if (and colon-idx
                     (< (1+ colon-idx) n)
                     (memq (aref line (1+ colon-idx)) '(?\s ?\t)))
                (let* ((spec-str (substring line (1+ i) colon-idx))
                       (style (hue-markdown-parse-spec spec-str)))
                  (if (not style)
                      (progn
                        (setq out (concat out "{"))
                        (setq i (1+ i)))
                    (let ((body-start (+ colon-idx 2))
                          (depth 1)
                          (p (+ colon-idx 2))
                          (close-brace nil))
                      (while (and (< p n) (not close-brace))
                        (let ((pc (aref line p)))
                          (cond
                           ((and (eq pc ?\\) (< (1+ p) n)) (setq p (1+ p)))
                           ((eq pc ?{) (setq depth (1+ depth)))
                           ((eq pc ?})
                            (setq depth (1- depth))
                            (when (= depth 0) (setq close-brace p)))))
                        (setq p (1+ p)))
                      (if (and close-brace (> close-brace body-start))
                          (let* ((inner (hue-markdown--downgrade-spans-in-line
                                         (substring line body-start close-brace)))
                                 (fg (plist-get style :fg)))
                            (if (memq fg '(red orange))
                                (setq out (concat out "**" inner "**"))
                              (setq out (concat out inner)))
                            (setq i (1+ close-brace)))
                        (setq out (concat out "{"))
                        (setq i (1+ i))))))
              (setq out (concat out "{"))
              (setq i (1+ i)))))))
    out))

(defun hue-markdown-downgrade-string (src)
  "Downgrade Hue Markdown string SRC into standard GitHub Markdown."
  (let* ((lines (split-string src "\r?\n"))
         (vec (vconcat lines))
         (total (length vec))
         (idx 0)
         (in-fence nil)
         (is-hue-fence nil)
         (fence-char nil)
         (fence-len 0)
         (out nil))
    (while (< idx total)
      (let* ((line (aref vec idx))
             (trimmed (replace-regexp-in-string "\\` \\{0,3\\}" "" line)))
        (cond
         ;; Fenced code block
         ((string-match "\\`\\(`\\{3,\\}\\|~\\{3,\\}\\)\\(.*\\)\\'" trimmed)
          (let* ((fence (match-string 1 trimmed))
                 (info (string-trim (match-string 2 trimmed)))
                 (fc (aref fence 0))
                 (flen (length fence)))
            (if (not in-fence)
                (progn
                  (setq in-fence t
                        fence-char fc
                        fence-len flen
                        is-hue-fence (string-match-p "\\`hue\\(?:[ \t]\\|\\'\\)" info))
                  (unless is-hue-fence
                    (push line out)))
              (when (and (eq fc fence-char) (>= flen fence-len))
                (unless is-hue-fence
                  (push line out))
                (setq in-fence nil
                      is-hue-fence nil))))
          (setq idx (1+ idx)))

         ((and in-fence (not is-hue-fence))
          (push line out)
          (setq idx (1+ idx)))

         (t
          (let ((top-info (hue-markdown-parse-top-border trimmed))
                (close-idx nil))
            (if top-info
                (let ((corners (plist-get top-info :corners))
                      (k (1+ idx))
                      (valid t))
                  (while (and (< k total) (not close-idx) valid)
                    (let ((ktrim (replace-regexp-in-string "\\` \\{0,3\\}" "" (aref vec k))))
                      (cond
                       ((hue-markdown--bottom-border-p ktrim corners) (setq close-idx k))
                       ((hue-markdown--side-line-p ktrim) nil)
                       (t (setq valid nil))))
                    (setq k (1+ k)))
                  (if close-idx
                      (let* ((style (plist-get top-info :style))
                             (title (plist-get top-info :title))
                             (color (or (plist-get style :fg) (plist-get style :bg) 'gray))
                             (alert (hue-markdown--box-alert-kind color)))
                        (push (format "> [!%s]" alert) out)
                        (unless (string-empty-p title)
                          (push (format "> **%s**" title) out))
                        (cl-loop for m from (1+ idx) below close-idx do
                                 (let* ((mline (replace-regexp-in-string "\\` \\{0,3\\}" "" (aref vec m)))
                                        (s1 (replace-regexp-in-string "\\`[│|] ?" "" mline))
                                        (s2 (replace-regexp-in-string "[ \t]*[│|][ \t]*\\'" "" s1))
                                        (s3 (hue-markdown--downgrade-spans-in-line s2)))
                                   (if (string-empty-p (string-trim s3))
                                       (push ">" out)
                                     (push (concat "> " s3) out))))
                        (setq idx (1+ close-idx)))
                    (push (hue-markdown--downgrade-spans-in-line line) out)
                    (setq idx (1+ idx))))
              (push (hue-markdown--downgrade-spans-in-line line) out)
              (setq idx (1+ idx))))))))
    (mapconcat #'identity (nreverse out) "\n")))

(defun hue-markdown-downgrade-buffer ()
  "Convert current Hue Markdown buffer to GitHub Markdown in a new buffer."
  (interactive)
  (let* ((src (buffer-substring-no-properties (point-min) (point-max)))
         (downgraded (hue-markdown-downgrade-string src))
         (buf (get-buffer-create "*Hue GitHub Downgrade*")))
    (with-current-buffer buf
      (erase-buffer)
      (insert downgraded)
      (goto-char (point-min))
      (if (fboundp 'gfm-mode)
          (gfm-mode)
        (when (fboundp 'markdown-mode)
          (markdown-mode))))
    (pop-to-buffer buf)))

;; ---------------------------------------------------------------------------
;; Pure-Elisp HTML Generator & In-Emacs Preview (Android & Desktop)
;; ---------------------------------------------------------------------------

(defun hue-markdown--escape-html (s)
  "Escape HTML special characters in string S."
  (let ((res s))
    (setq res (replace-regexp-in-string "&" "&amp;" res t t))
    (setq res (replace-regexp-in-string "<" "&lt;" res t t))
    (setq res (replace-regexp-in-string ">" "&gt;" res t t))
    res))

(defun hue-markdown-preview-buffer ()
  "Open a live rendered preview of the current Hue Markdown buffer inside Emacs.
Works out-of-the-box on Android Emacs and Desktop Emacs without needing an
external browser or Node.js."
  (interactive)
  (let* ((src (buffer-substring-no-properties (point-min) (point-max)))
         (preview-buf (get-buffer-create "*Hue Preview*")))
    (with-current-buffer preview-buf
      (let ((inhibit-read-only t))
        (erase-buffer)
        (insert src)
        (goto-char (point-min))
        (hue-markdown-mode 1)
        (setq-local hue-markdown-conceal-delimiters t)
        (add-to-invisibility-spec 'hue-markdown-delimiter)
        (hue-markdown-fontify-buffer)
        (read-only-mode 1)))
    (pop-to-buffer preview-buf)
    (message "Hue in-Emacs preview updated (delimiters concealed; press q to close).")))

(defun hue-markdown-preview-browser ()
  "Render current buffer to a standalone Hue HTML file and open in browser."
  (interactive)
  (let* ((src (buffer-substring-no-properties (point-min) (point-max)))
         (in-file (make-temp-file "hue-emacs-" nil ".hue.md"))
         (out-file (make-temp-file "hue-emacs-preview-" nil ".html")))
    (with-temp-file in-file
      (insert src))
    (if (and (executable-find "node")
             (file-exists-p (expand-file-name "packages/md-hue/bin/md-hue.js" default-directory)))
        (call-process "node" nil nil nil
                      (expand-file-name "packages/md-hue/bin/md-hue.js" default-directory)
                      "html" in-file "--standalone" "-o" out-file)
      (with-temp-file out-file
        (insert "<!doctype html><html><head><meta charset=\"utf-8\">"
                "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
                "<title>Hue Preview</title></head><body><pre>"
                (hue-markdown--escape-html src)
                "</pre></body></html>")))
    (browse-url-of-file out-file)))

;; ---------------------------------------------------------------------------
;; Keymap, Touch Menu Bar (`Hue`), Minor Mode & Major Mode
;; ---------------------------------------------------------------------------

(defvar hue-markdown-mode-map
  (let ((map (make-sparse-keymap)))
    (define-key map (kbd "C-c C-h p") #'hue-markdown-preview-buffer)
    (define-key map (kbd "C-c C-h b") #'hue-markdown-preview-browser)
    (define-key map (kbd "C-c C-h d") #'hue-markdown-downgrade-buffer)
    (define-key map (kbd "C-c C-h s") #'hue-markdown-insert-span)
    (define-key map (kbd "C-c C-h x") #'hue-markdown-insert-box)
    (define-key map (kbd "C-c C-h c") #'hue-markdown-toggle-conceal)
    (define-key map (kbd "C-c C-h r") #'hue-markdown-fontify-buffer)
    map)
  "Keymap for `hue-markdown-mode'.")

(easy-menu-define hue-markdown-menu hue-markdown-mode-map
  "Menu for Hue Markdown mode (accessible via top menu bar on Android Emacs)."
  '("Hue"
    ["Wrap Region/Word in Hue Span..." hue-markdown-insert-span t]
    ["Wrap Region/Line in Hue Box..." hue-markdown-insert-box t]
    "---"
    ["In-Emacs Clean Preview (Conceal Delimiters)" hue-markdown-preview-buffer t]
    ["Toggle Hide {spec:} Delimiters" hue-markdown-toggle-conceal
     :style toggle :selected hue-markdown-conceal-delimiters]
    ["HTML Preview in Browser" hue-markdown-preview-browser t]
    ["Downgrade to GitHub Markdown" hue-markdown-downgrade-buffer t]
    "---"
    ["Refresh Hue Coloring" hue-markdown-fontify-buffer t]))

;;;###autoload
(define-minor-mode hue-markdown-mode
  "Minor mode for coloring and authoring Hue Markdown (`.hue.md').
Works in any buffer (including `markdown-mode', `gfm-mode', or `text-mode')
on both Desktop Emacs and Android Emacs."
  :lighter " Hue"
  :keymap hue-markdown-mode-map
  (if hue-markdown-mode
      (progn
        (when hue-markdown-conceal-delimiters
          (add-to-invisibility-spec 'hue-markdown-delimiter))
        (hue-markdown-fontify-buffer)
        (add-hook 'after-change-functions #'hue-markdown--schedule-refresh nil t))
    (remove-hook 'after-change-functions #'hue-markdown--schedule-refresh t)
    (when hue-markdown--refresh-timer
      (cancel-timer hue-markdown--refresh-timer)
      (setq hue-markdown--refresh-timer nil))
    (remove-from-invisibility-spec 'hue-markdown-delimiter)
    (hue-markdown--clear-overlays)))

(defconst hue-markdown--basic-font-lock-keywords
  '(("^#+[ \t]+.*$" . font-lock-function-name-face)
    ("`[^`\n]+`" . font-lock-constant-face)
    ("\\*\\*[^*\n]+\\*\\*" . 'bold))
  "Fallback Markdown font-lock rules when `markdown-mode' is not installed.")

;;;###autoload
(define-derived-mode hue-markdown-major-mode
  (if (fboundp 'markdown-mode) 'markdown-mode 'text-mode)
  "Hue-MD"
  "Major mode for editing Hue Markdown (`.hue.md') files."
  (unless (fboundp 'markdown-mode)
    (setq-local font-lock-defaults '(hue-markdown--basic-font-lock-keywords)))
  (hue-markdown-mode 1))

;;;###autoload
(add-to-list 'auto-mode-alist '("\\.hue\\.md\\'" . hue-markdown-major-mode))

(provide 'hue-markdown-mode)
;;; hue-markdown-mode.el ends here
