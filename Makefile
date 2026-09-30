# Shortcuts. Pass env vars inline, e.g.:  make load VUS=50 HOLD=10m
.EXPORT_ALL_VARIABLES:
.PHONY: help smoke load stress spike soak run new save results report report-all install

help:
	@echo "make smoke|load|stress|spike|soak   run a built-in test"
	@echo "make run T=<name> [ARGS='--vus 5']  run scripts/<name>.js"
	@echo "make new N=<name>                   scaffold scripts/<name>.js"
	@echo "make results                        list past runs"
	@echo "make report [R=<match>]             view a saved HTML report"
	@echo "make report-all                     browsable index of all runs"
	@echo "make save [M='message']             commit + push to GitHub"
	@echo "make install                        (re)install k6"

smoke load stress spike soak:
	@bin/k6run $@ $(ARGS)

run:
	@bin/k6run $(T) $(ARGS)

new:
	@bin/k6new $(N)

results:
	@bin/k6results

report:
	@bin/k6report $(R)

report-all:
	@bin/k6report --all

save:
	@bin/k6save $(if $(M),"$(M)",)

install:
	@bash .devcontainer/install-k6.sh
