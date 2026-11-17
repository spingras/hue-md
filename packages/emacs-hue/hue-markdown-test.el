;;; hue-markdown-test.el --- ERT tests for hue-markdown-mode -*- lexical-binding: t; -*-

;;; Commentary:
;; Run in batch mode with:
;;   emacs -Q --batch -L . -l hue-markdown-mode.el -l hue-markdown-test.el -f ert-run-tests-batch-and-exit

;;; Code:

(require 'ert)
(require 'hue-markdown-mode)

(ert-deftest hue-markdown-test-parse-spec ()
  "Verify token, semantic alias, background, hex, and false-positive rules."
  (should (equal (hue-markdown-parse-spec "red")
                 '(:fg red :bg nil :fg-hex nil :bg-hex nil)))
  (should (equal (hue-markdown-parse-spec "warn")
                 '(:fg orange :bg nil :fg-hex nil :bg-hex nil)))
  (should (equal (hue-markdown-parse-spec "! bg-gray")
                 '(:fg red :bg gray :fg-hex nil :bg-hex nil)))
  (should (equal (hue-markdown-parse-spec "#c0ffee bg-#333333")
                 '(:fg nil :bg nil :fg-hex "#c0ffee" :bg-hex "#333333")))
  ;; Last token of same kind wins
  (should (equal (hue-markdown-parse-spec "#c0ffee blue")
                 '(:fg blue :bg nil :fg-hex nil :bg-hex nil)))
  ;; Unknown tokens must return nil so `{a: 1}' is ignored
  (should-not (hue-markdown-parse-spec "a"))
  (should-not (hue-markdown-parse-spec "key")))

(ert-deftest hue-markdown-test-parse-top-border ()
  "Verify Unicode, rounded, and ASCII box top border parsing."
  (let ((top1 (hue-markdown-parse-top-border "┌─ ! Never commit secrets ─────────┐")))
    (should top1)
    (should (eq (plist-get top1 :corners) 'square))
    (should (equal (plist-get top1 :title) "Never commit secrets"))
    (should (eq (plist-get (plist-get top1 :style) :fg) 'red)))
  (let ((top2 (hue-markdown-parse-top-border "╭─ ok ───────────────╮")))
    (should top2)
    (should (eq (plist-get top2 :corners) 'round))
    (should (equal (plist-get top2 :title) ""))
    (should (eq (plist-get (plist-get top2 :style) :fg) 'green)))
  (let ((top3 (hue-markdown-parse-top-border "+-- info Typing tip --+")))
    (should top3)
    (should (eq (plist-get top3 :corners) 'ascii))
    (should (equal (plist-get top3 :title) "Typing tip"))
    (should (eq (plist-get (plist-get top3 :style) :fg) 'blue)))
  ;; Open ASCII box without trailing corners
  (let ((top4 (hue-markdown-parse-top-border "+-- info Pro Tip")))
    (should top4)
    (should (eq (plist-get top4 :corners) 'ascii))
    (should (equal (plist-get top4 :title) "Pro Tip"))
    (should (eq (plist-get (plist-get top4 :style) :fg) 'blue)))
  ;; Open bottom border
  (should (hue-markdown--bottom-border-p "+--" 'ascii))
  (should (hue-markdown--bottom-border-p "└──" 'square))
  ;; Mismatched corners must return nil
  (should-not (hue-markdown-parse-top-border "┌── bad ──+")))

(ert-deftest hue-markdown-test-fontify-buffer ()
  "Verify overlays are created on Hue spans and boxes, and skipped on `{a: 1}'."
  (with-temp-buffer
    (insert "Build: {ok: passing} and {a: 1}\n"
            "┌─ ! Alert ──────────┐\n"
            "│ Inside {!: now}    │\n"
            "└────────────────────┘\n")
    (hue-markdown-mode 1)
    (let ((ovs (overlays-in (point-min) (point-max))))
      (should (> (length ovs) 5)))))

(ert-deftest hue-markdown-test-downgrade-string ()
  "Verify pure-Elisp GitHub Markdown downgrade."
  (let* ((input "Status: {!: blocked} and {ok: passing}\n\n┌─ info Note title ────┐\n│ Body line            │\n└──────────────────────┘")
         (out (hue-markdown-downgrade-string input)))
    (should (string-match-p "Status: \\*\\*blocked\\*\\* and passing" out))
    (should (string-match-p "> \\[!NOTE\\]" out))
    (should (string-match-p "> \\*\\*Note title\\*\\*" out))
    (should (string-match-p "> Body line" out))))

(provide 'hue-markdown-test)
;;; hue-markdown-test.el ends here
